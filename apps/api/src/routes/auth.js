import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { logAudit } from "../services/auditService.js";

const router = Router();

router.post("/login", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { data, error } = await supabaseAdmin.auth.signInWithPassword(parsed.data);
  if (error) return res.status(401).json({ message: "Credenciais inválidas." });

  return res.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: data.user
  });
});

router.post("/invite-manager", requireAuth, requireAdmin, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    storeIds: z.array(z.string().uuid()).min(1),
    managerName: z.string().min(2)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      store_id: parsed.data.storeIds[0],
      store_ids: parsed.data.storeIds,
      manager_name: parsed.data.managerName
    }
  });
  if (error) return res.status(400).json({ message: error.message });

  if (data.user?.id) {
    const links = parsed.data.storeIds.map((storeId) => ({
      manager_auth_user_id: data.user.id,
      store_id: storeId
    }));
    await supabaseAdmin.from("manager_store_links").upsert(links, {
      onConflict: "manager_auth_user_id,store_id"
    });
  }

  await logAudit({
    userId: req.user.id,
    action: "invite",
    resource: "manager",
    payload: { invitedUser: data.user?.id, stores: parsed.data.storeIds }
  });

  return res.status(201).json({ invitedUser: data.user?.id, message: "Convite enviado com sucesso." });
});

router.get("/admin/managers", requireAuth, requireAdmin, async (_req, res) => {
  const [{ data: usersData, error: usersError }, { data: links, error: linksError }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers(),
    supabaseAdmin.from("manager_store_links").select("manager_auth_user_id, store_id, stores(name, store_number)")
  ]);
  if (usersError) return res.status(400).json({ message: usersError.message });
  if (linksError) return res.status(400).json({ message: linksError.message });

  const managers = (usersData?.users || []).filter((u) => u.app_metadata?.role === "manager");
  const data = managers.map((manager) => {
    const managerLinks = (links || []).filter((l) => l.manager_auth_user_id === manager.id);
    return {
      id: manager.id,
      email: manager.email,
      managerName: manager.user_metadata?.manager_name || manager.user_metadata?.display_name || "",
      invitedAt: manager.created_at,
      lastSignInAt: manager.last_sign_in_at,
      status: manager.last_sign_in_at ? "ativo" : "pendente",
      stores: managerLinks.map((l) => ({
        id: l.store_id,
        name: l.stores?.name,
        storeNumber: l.stores?.store_number
      }))
    };
  });

  return res.json(data);
});

router.post("/admin/managers/:id/resend-invite", requireAuth, requireAdmin, async (req, res) => {
  const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(req.params.id);
  if (error || !user?.user?.email) return res.status(404).json({ message: "Gerente não encontrado." });

  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(user.user.email, {
    data: user.user.user_metadata || {}
  });
  if (inviteError) {
    const msg = inviteError.message || "";
    // Quando o usuário já existe e está ativo, o Supabase pode retornar 400.
    // Para UX do admin, tratamos como sucesso (ação idempotente) e orientamos o próximo passo.
    if (msg.toLowerCase().includes("already been registered")) {
      return res.json({
        message:
          "Este e-mail já está cadastrado. Se precisar recuperar acesso, use o fluxo de redefinição de senha (Esqueci minha senha)."
      });
    }
    return res.status(400).json({ message: msg });
  }

  await logAudit({
    userId: req.user.id,
    action: "resend_invite",
    resource: "manager",
    payload: { managerId: req.params.id }
  });
  return res.json({ message: "Convite reenviado com sucesso." });
});

export default router;

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { sendPasswordRecoveryToEmail } from "../lib/passwordRecovery.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { logAudit } from "../services/auditService.js";

const router = Router();

/** Limite extra no “esqueci senha” público (além do limite global da app e do Supabase). */
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler(_req, res) {
    res.status(429).json({
      message:
        "Muitas tentativas a partir deste endereço. Aguarde cerca de 15 minutos antes de pedir outro link, ou contacte o administrador."
    });
  }
});

/** Lista todos os utilizadores Auth (paginação interna). */
async function listAllAuthUsers() {
  const all = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const batch = data?.users || [];
    all.push(...batch);
    if (batch.length < 200) break;
  }
  return all;
}

/** Cada loja só pode estar ligada a um gerente (unique em store_id). */
async function syncManagerStoreLinks(managerAuthUserId, storeIds) {
  await supabaseAdmin.from("manager_store_links").delete().eq("manager_auth_user_id", managerAuthUserId);
  for (const storeId of storeIds) {
    await supabaseAdmin.from("manager_store_links").delete().eq("store_id", storeId);
  }
  if (!storeIds.length) return;
  const rows = storeIds.map((store_id) => ({
    manager_auth_user_id: managerAuthUserId,
    store_id
  }));
  const { error } = await supabaseAdmin.from("manager_store_links").insert(rows);
  if (error) throw error;
}

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

/**
 * Público: pede e-mail de redefinição de senha via Supabase Auth.
 * Resposta genérica em caso de sucesso (não revela se o e-mail existe).
 * redirect_to fixo = APP_ORIGIN + /reset-password (evita localhost se o browser estiver errado).
 */
router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Informe um e-mail válido." });
  }

  const result = await sendPasswordRecoveryToEmail(parsed.data.email);

  if (result.code === "missing_anon_key") {
    return res.status(500).json({
      message: "Servidor sem SUPABASE_PUBLISHABLE_KEY. Contacte o administrador."
    });
  }

  const errMsg = String(result.json?.message || result.json?.error_description || result.body || "").toLowerCase();
  if (result.status === 429 || errMsg.includes("over_email_send_rate_limit") || errMsg.includes("email rate limit")) {
    return res.status(429).json({
      message:
        "Limite de envio de e-mails atingido (proteção do Supabase). Aguarde cerca de 1 hora ou configure SMTP personalizado no projeto Supabase para limites maiores."
    });
  }

  if (!result.ok && (errMsg.includes("redirect") || errMsg.includes("redirect_uri"))) {
    return res.status(500).json({
      message:
        "URL de redirecionamento não autorizada no Supabase. Em Authentication → URL Configuration, inclua a URL de /reset-password do painel."
    });
  }

  return res.json({
    ok: true,
    message:
      "Se este e-mail estiver cadastrado, em breve você receberá um link para redefinir a senha. Verifique também o spam."
  });
});

router.post("/invite-manager", requireAuth, requireAdmin, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    storeIds: z.array(z.string().uuid()).min(1),
    managerName: z.string().min(2),
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.")
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: { role: "manager" },
    user_metadata: {
      store_id: parsed.data.storeIds[0],
      store_ids: parsed.data.storeIds,
      manager_name: parsed.data.managerName,
      display_name: parsed.data.managerName
    }
  });

  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return res.status(400).json({ message: "Este e-mail já está cadastrado. Use outro e-mail ou remova o gerente existente." });
    }
    return res.status(400).json({ message: error.message });
  }

  const userId = data.user?.id;
  if (!userId) return res.status(400).json({ message: "Falha ao criar utilizador." });

  try {
    await syncManagerStoreLinks(userId, parsed.data.storeIds);
  } catch (e) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return res.status(400).json({ message: e?.message || "Falha ao vincular lojas." });
  }

  await logAudit({
    userId: req.user.id,
    action: "create_manager",
    resource: "manager",
    payload: { newUserId: userId, stores: parsed.data.storeIds }
  });

  return res.status(201).json({
    userId,
    message: "Gerente criado. Ele pode entrar no painel com este e-mail e a senha que definiu."
  });
});

router.get("/admin/managers", requireAuth, requireAdmin, async (_req, res) => {
  let allUsers;
  try {
    allUsers = await listAllAuthUsers();
  } catch (e) {
    return res.status(400).json({ message: e?.message || "Falha ao listar utilizadores." });
  }
  const { data: links, error: linksError } = await supabaseAdmin
    .from("manager_store_links")
    .select("manager_auth_user_id, store_id, stores(id, name, store_number)");
  if (linksError) return res.status(400).json({ message: linksError.message });

  const managers = allUsers.filter((u) => u.app_metadata?.role === "manager");
  const data = managers.map((manager) => {
    const managerLinks = (links || []).filter((l) => l.manager_auth_user_id === manager.id);
    return {
      id: manager.id,
      email: manager.email,
      managerName: manager.user_metadata?.manager_name || manager.user_metadata?.display_name || "",
      invitedAt: manager.created_at,
      lastSignInAt: manager.last_sign_in_at,
      /** "sem login ainda" = conta criada mas nunca fez sign-in (não bloqueia o 1º acesso). */
      status: manager.last_sign_in_at ? "ativo" : "sem login ainda",
      stores: managerLinks.map((l) => ({
        id: l.store_id,
        name: l.stores?.name,
        storeNumber: l.stores?.store_number
      })),
      storeIds: managerLinks.map((l) => l.store_id)
    };
  });

  return res.json(data);
});

router.patch("/admin/me", requireAuth, requireAdmin, async (req, res) => {
  const schema = z
    .object({
      email: z.string().email().optional(),
      password: z.string().min(8).optional(),
      displayName: z.string().min(2).max(120).optional()
    })
    .refine((b) => Boolean((b.email && b.email.trim()) || b.password || (b.displayName && b.displayName.trim().length >= 2)), {
      message: "Informe e-mail, senha ou nome para atualizar."
    });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { data: current, error: getErr } = await supabaseAdmin.auth.admin.getUserById(req.user.id);
  if (getErr || !current?.user) return res.status(400).json({ message: getErr?.message || "Utilizador não encontrado." });

  const patch = {};
  if (parsed.data.email) patch.email = parsed.data.email;
  if (parsed.data.password) patch.password = parsed.data.password;
  if (parsed.data.displayName) {
    patch.user_metadata = {
      ...(current.user.user_metadata || {}),
      display_name: parsed.data.displayName
    };
  }

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, patch);
  if (error) return res.status(400).json({ message: error.message });

  await logAudit({
    userId: req.user.id,
    action: "update",
    resource: "admin_profile",
    payload: { fields: Object.keys(parsed.data).filter((k) => parsed.data[k]) }
  });

  return res.json({
    id: data.user.id,
    email: data.user.email,
    displayName: data.user.user_metadata?.display_name ?? null
  });
});

router.put("/admin/managers/:id", requireAuth, requireAdmin, async (req, res) => {
  const managerId = req.params.id;
  if (managerId === req.user.id) return res.status(400).json({ message: "Use a página de configurações para a sua própria conta." });

  const schema = z.object({
    email: z.string().email().optional(),
    password: z.string().optional(),
    managerName: z.string().min(2).max(120),
    storeIds: z.array(z.string().uuid()).min(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { data: wrap, error: getErr } = await supabaseAdmin.auth.admin.getUserById(managerId);
  if (getErr || !wrap?.user) return res.status(404).json({ message: "Gerente não encontrado." });
  if (wrap.user.app_metadata?.role !== "manager") {
    return res.status(400).json({ message: "Este utilizador não é um gerente." });
  }

  const storeIds = parsed.data.storeIds;
  const userMeta = {
    ...(wrap.user.user_metadata || {}),
    store_id: storeIds[0],
    store_ids: storeIds,
    manager_name: parsed.data.managerName,
    display_name: parsed.data.managerName
  };

  const updatePayload = {
    app_metadata: { role: "manager" },
    user_metadata: userMeta
  };
  if (parsed.data.email) updatePayload.email = parsed.data.email;
  if (parsed.data.password && String(parsed.data.password).length >= 8) {
    updatePayload.password = parsed.data.password;
  }

  const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(managerId, updatePayload);
  if (upErr) return res.status(400).json({ message: upErr.message });

  try {
    await syncManagerStoreLinks(managerId, storeIds);
  } catch (e) {
    return res.status(400).json({ message: e?.message || "Falha ao atualizar vínculos com lojas." });
  }

  await logAudit({
    userId: req.user.id,
    action: "update",
    resource: "manager",
    payload: { managerId, storeIds }
  });

  return res.json({ ok: true });
});

router.delete("/admin/managers/:id", requireAuth, requireAdmin, async (req, res) => {
  const managerId = req.params.id;
  if (managerId === req.user.id) return res.status(400).json({ message: "Não pode remover a si mesmo." });

  const { data: wrap, error: getErr } = await supabaseAdmin.auth.admin.getUserById(managerId);
  if (getErr || !wrap?.user) return res.status(404).json({ message: "Gerente não encontrado." });
  if (wrap.user.app_metadata?.role !== "manager") {
    return res.status(400).json({ message: "Este utilizador não é um gerente." });
  }

  await supabaseAdmin.from("manager_store_links").delete().eq("manager_auth_user_id", managerId);
  const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(managerId);
  if (delErr) return res.status(400).json({ message: delErr.message });

  await logAudit({
    userId: req.user.id,
    action: "delete",
    resource: "manager",
    payload: { managerId }
  });

  return res.status(204).send();
});

router.post("/admin/managers/:id/resend-invite", requireAuth, requireAdmin, async (req, res) => {
  const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(req.params.id);
  if (error || !user?.user?.email) return res.status(404).json({ message: "Gerente não encontrado." });

  const email = user.user.email;
  const result = await sendPasswordRecoveryToEmail(email);

  if (result.code === "missing_anon_key") {
    return res.status(500).json({
      message: "Configure SUPABASE_PUBLISHABLE_KEY na API para enviar e-mail de redefinição de senha."
    });
  }

  const errMsg = String(result.json?.message || result.json?.error_description || result.body || "").toLowerCase();
  if (result.status === 429 || errMsg.includes("over_email_send_rate_limit") || errMsg.includes("email rate limit")) {
    return res.status(429).json({
      message:
        "Limite de e-mails do Supabase atingido. Tente de novo mais tarde ou configure SMTP no painel do Supabase."
    });
  }

  if (!result.ok) {
    return res.status(400).json({
      message: result.body?.slice(0, 200) || "Não foi possível pedir o e-mail de redefinição de senha."
    });
  }

  await logAudit({
    userId: req.user.id,
    action: "resend_password_reset",
    resource: "manager",
    payload: { managerId: req.params.id }
  });

  return res.json({
    message:
      "Se o projeto Supabase tiver e-mail (Auth) configurado, o gerente receberá um link para redefinir a senha. Caso contrário, configure SMTP em Project Settings → Auth."
  });
});

export default router;

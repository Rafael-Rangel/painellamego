import { useCallback, useEffect, useRef, useState } from "react";
import { api, withAuth } from "../api";
import { compressReceiptFilesForSubmit } from "../lib/compressReceiptImages";

/**
 * Rascunho no servidor: continuar lançamento em notebook ou celular.
 */
export function usePurchaseDraft(token, { payload, enabled = true }) {
  const [draftId, setDraftId] = useState(null);
  const [openDrafts, setOpenDrafts] = useState([]);
  const [serverReceipts, setServerReceipts] = useState([]);
  const [saveState, setSaveState] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const saveTimerRef = useRef(null);

  const payloadHasContent = useCallback((p) => {
    if (!p) return false;
    if (p.supplierId) return true;
    if (p.invoiceNumber && String(p.invoiceNumber).trim()) return true;
    return Array.isArray(p.items) && p.items.length > 0;
  }, []);

  const resetDraftSession = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setDraftId(null);
    setServerReceipts([]);
    setSaveState("idle");
    setLastSavedAt(null);
  }, []);

  const refreshOpenDrafts = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get("/purchases/drafts", withAuth(token));
      setOpenDrafts(data || []);
    } catch {
      setOpenDrafts([]);
    }
  }, [token]);

  const loadDraft = useCallback(
    async (id) => {
      const { data } = await api.get(`/purchases/drafts/${id}`, withAuth(token));
      setDraftId(data.id);
      setServerReceipts(data.receipts || []);
      return data;
    },
    [token]
  );

  const createDraft = useCallback(async () => {
    const { data } = await api.post("/purchases/drafts", {}, withAuth(token));
    setDraftId(data.draftId);
    await refreshOpenDrafts();
    return data.draftId;
  }, [token, refreshOpenDrafts]);

  const saveDraft = useCallback(
    async (override = {}, idOverride = null) => {
      const id = idOverride || draftId;
      if (!id || !token) return;
      setSaveState("saving");
      try {
        await api.put(`/purchases/drafts/${id}`, { ...payload, ...override }, withAuth(token));
        if (idOverride && idOverride !== draftId) setDraftId(idOverride);
        setSaveState("saved");
        setLastSavedAt(new Date());
      } catch (err) {
        setSaveState("error");
        throw err;
      }
    },
    [draftId, token, payload]
  );

  const uploadReceipts = useCallback(
    async (files, idOverride = null) => {
      const id = idOverride || draftId;
      if (!id || !files?.length) return [];
      if (idOverride && idOverride !== draftId) setDraftId(idOverride);
      const compressed = await compressReceiptFilesForSubmit(files);
      const form = new FormData();
      for (const f of compressed) form.append("receipts", f);
      const { data } = await api.post(`/purchases/drafts/${id}/receipts`, form, {
        headers: { ...withAuth(token).headers, "Content-Type": "multipart/form-data" }
      });
      const { data: full } = await api.get(`/purchases/drafts/${id}`, withAuth(token));
      setServerReceipts(full.receipts || []);
      return data.uploaded || [];
    },
    [draftId, token]
  );

  const removeServerReceipt = useCallback(
    async (receiptId) => {
      await api.delete(`/purchases/drafts/${draftId}/receipts/${receiptId}`, withAuth(token));
      setServerReceipts((prev) => prev.filter((r) => r.id !== receiptId));
    },
    [draftId, token]
  );

  useEffect(() => {
    if (token) void refreshOpenDrafts();
  }, [token, refreshOpenDrafts]);

  useEffect(() => {
    if (!enabled || !draftId || !payload) return;
    if (!payloadHasContent(payload)) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveDraft();
    }, 1800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [enabled, draftId, payload, saveDraft, payloadHasContent]);

  return {
    draftId,
    setDraftId,
    openDrafts,
    serverReceipts,
    saveState,
    lastSavedAt,
    refreshOpenDrafts,
    loadDraft,
    createDraft,
    saveDraft,
    uploadReceipts,
    removeServerReceipt,
    resetDraftSession
  };
}

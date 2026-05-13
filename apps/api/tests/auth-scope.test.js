import test from "node:test";
import assert from "node:assert/strict";
import { checkStoreScope, requireAdmin, resolveStoreScope } from "../src/middleware/auth.js";

function createRes() {
  return {
    code: null,
    body: null,
    status(code) {
      this.code = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test("checkStoreScope bloqueia gerente em outra loja", () => {
  const req = {
    user: { role: "manager", storeId: "store-a" },
    params: { storeId: "store-b" },
    body: {},
    query: {}
  };
  const res = createRes();
  let nextCalled = false;
  checkStoreScope(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.code, 403);
});

test("resolveStoreScope força storeId do gerente", () => {
  const req = {
    user: { role: "manager", storeId: "store-a" },
    params: { storeId: "store-b" },
    body: { storeId: "store-c" },
    query: {}
  };
  resolveStoreScope(req, {}, () => {});
  assert.equal(req.storeScopeId, "store-a");
});

test("requireAdmin permite apenas admin", () => {
  const req = { user: { role: "manager" } };
  const res = createRes();
  let nextCalled = false;
  requireAdmin(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.code, 403);
});

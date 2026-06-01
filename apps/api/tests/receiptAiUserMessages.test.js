import test from "node:test";
import assert from "node:assert/strict";
import {
  receiptAiUserFacingMessage,
  RECEIPT_AI_USER_DEFAULT,
  RECEIPT_AI_USER_TIMEOUT,
  RECEIPT_AI_USER_UNREADABLE
} from "../src/lib/receiptAiUserMessages.js";

test("receiptAiUserFacingMessage: quota/billing nunca vaza para UI", () => {
  const msg = receiptAiUserFacingMessage("You exceeded your current quota, please check billing");
  assert.equal(msg, RECEIPT_AI_USER_DEFAULT);
  assert.doesNotMatch(msg, /quota|billing|api|openai|openrouter/i);
});

test("receiptAiUserFacingMessage: erro composto OpenAI/OpenRouter", () => {
  const msg = receiptAiUserFacingMessage(
    "IA (OpenAI/OpenRouter): [gpt-5.5] quota exceeded || A IA retornou resposta em formato inválido."
  );
  assert.equal(msg, RECEIPT_AI_USER_DEFAULT);
  assert.doesNotMatch(msg, /quota|billing|openai|openrouter|gpt/i);
});

test("receiptAiUserFacingMessage: timeout", () => {
  assert.equal(receiptAiUserFacingMessage({ code: "ECONNABORTED" }), RECEIPT_AI_USER_TIMEOUT);
  assert.equal(receiptAiUserFacingMessage({ status: 504 }), RECEIPT_AI_USER_TIMEOUT);
});

test("receiptAiUserFacingMessage: resposta ilegível", () => {
  assert.equal(
    receiptAiUserFacingMessage("A IA retornou resposta em formato inválido."),
    RECEIPT_AI_USER_UNREADABLE
  );
});

test("receiptAiUserFacingMessage: chaves em falta", () => {
  assert.equal(receiptAiUserFacingMessage("RECEIPT_AI_KEYS_MISSING"), RECEIPT_AI_USER_DEFAULT);
});

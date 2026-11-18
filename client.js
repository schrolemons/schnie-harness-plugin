/* Generated from ui/native-cards.js. */
window.__ModuleLoader__.load({id:'dsh-schnie-archive',factory(require){const module={exports:{}};const exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ui/native-cards.js
var native_cards_exports = {};
__export(native_cards_exports, {
  SourceCards: () => SourceCards,
  apply: () => apply,
  cardsFromEvent: () => cardsFromEvent,
  cardsFromRecord: () => cardsFromRecord,
  inject: () => inject,
  referenceDefinition: () => referenceDefinition
});
module.exports = __toCommonJS(native_cards_exports);
var import_react = __toESM(require("react"), 1);

// protocol/info-card-v1.mjs
var MAX_STREAM_BYTES = 1024 * 1024;
var ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
var ProtocolError = class extends Error {
  constructor(message = "\u5916\u90E8\u670D\u52A1\u8FD4\u56DE\u7684SSE\u4E0D\u7B26\u5408info-card-sse/1\u534F\u8BAE\u3002") {
    super(message);
    this.name = "ProtocolError";
  }
};
var fail = () => {
  throw new ProtocolError();
};
var object = (value) => value && typeof value === "object" && !Array.isArray(value);
var string = (value, max, allowEmpty = false) => typeof value === "string" && value.length <= max && (allowEmpty || value.trim().length > 0);
function safeCardUrl(value) {
  if (!string(value, 2048) || /[\x00-\x20\x7f\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return !url.username && !url.password && (url.protocol === "https:" || url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
  } catch {
    return false;
  }
}
function validateCards(value) {
  if (!Array.isArray(value) || value.length > 10) fail();
  const ids = /* @__PURE__ */ new Set(), orders = [];
  const cards = value.map((card) => {
    if (!object(card) || Object.keys(card).some((key) => !["id", "title", "url", "excerpt", "used", "order"].includes(key)) || typeof card.id !== "string" || !ID.test(card.id) || ids.has(card.id) || !string(card.title, 160) || !safeCardUrl(card.url) || typeof card.used !== "boolean" || !string(card.excerpt ?? "", 1200, true)) fail();
    ids.add(card.id);
    if (card.used) {
      if (!Number.isInteger(card.order) || card.order < 1 || card.order > 10) fail();
      orders.push(card.order);
    } else if (card.order !== null) fail();
    return { id: card.id, title: card.title, url: card.url, excerpt: card.excerpt ?? "", used: card.used, order: card.order };
  });
  orders.sort((a, b) => a - b);
  if (orders.some((order, index) => order !== index + 1)) fail();
  return cards;
}

// ui/native-cards.js
var KIND = "info-card-sources";
var RECORD_TYPE = "plugin:dsh-schnie-archive/citations";
function cardsFromRecord(event, record) {
  try {
    if (event?.type !== "assistant/message" || event.data?.interrupted || record?.type !== RECORD_TYPE || record.ignorable !== true) return [];
    const data = record.data, source = event.data.message?.source;
    if (data?.protocol !== "info-card-sse" || data.version !== 1 || typeof data.request_id !== "string" || !source || source.kind !== "model" || source.provider !== data.provider || source.model !== data.model || data.turn !== event.data.turn || data.step !== event.data.step) return [];
    const text = event.data.message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    if (text !== data.answer) return [];
    return validateCards(data.info_card).filter((c) => c.used).sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}
function cardsFromEvent(event) {
  try {
    if (event?.type !== "assistant/message" || event.data?.interrupted) return [];
    const message = event.data.message, source = message?.source;
    if (source?.kind !== "model" || source.provider !== "external-sse" || source.model !== "answer") return [];
    const payload = source.replayState?.response ?? source.replayState;
    if (payload?.protocol !== "info-card-sse" || payload.version !== 1 || typeof payload.request_id !== "string") return [];
    const text = message.content.filter((block) => block.type === "text").map((block) => block.text).join("");
    if (payload.text_length !== [...text].length) return [];
    return validateCards(payload.info_card).filter((card) => card.used).sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}
var referenceDefinition = {
  kind: KIND,
  target: "chat",
  match(event) {
    if (!["step/start", "assistant/message", "llm/retry", RECORD_TYPE].includes(event.type) || !Number.isSafeInteger(event.data?.turn) || !Number.isSafeInteger(event.data?.step)) return null;
    return { id: `${event.data.turn}:${event.data.step}`, role: event.type === "step/start" ? "start" : "update" };
  },
  start() {
    return {};
  },
  update(context) {
    return context.state;
  },
  buildViewNode(context) {
    const events = [context.start?.event, ...context.matches.map((m) => m.event)].filter(Boolean);
    const reset = events.findLastIndex((e) => e.type === "step/start" || e.type === "llm/retry");
    const current = events.slice(reset + 1), event = current.findLast((e) => e.type === "assistant/message");
    const record = current.findLast((e) => e.type === RECORD_TYPE);
    const cards = record ? cardsFromRecord(event, record) : cardsFromEvent(event);
    return { key: context.key, id: context.id, kind: KIND, target: "chat", location: context.start?.location ?? context.matches.at(-1)?.location ?? { kind: "unresolved" }, groupTree: "turn", anchorSeq: (event?.seq ?? 0) + 1e-3, visibility: cards.length ? "visible" : "hidden", data: { cards } };
  }
};
function SourceCards({ node }) {
  const h = import_react.default.createElement, cards = node.data.cards;
  if (!cards?.length) return null;
  return h(
    "nav",
    { "aria-label": "\u56DE\u7B54\u5F15\u7528\u6765\u6E90", "data-info-card-sources": "", style: { border: "1px solid var(--dsw-alias-outline-primary,rgba(127,127,127,.2))", borderRadius: 12, padding: "12px 16px", margin: "12px 0", fontSize: 13, lineHeight: 1.6, overflowWrap: "anywhere" } },
    h("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary,#7a8290)", marginBottom: 6 } }, `\u53C2\u8003\u6765\u6E90 \xB7 ${cards.length}`),
    h("ol", { style: { listStyle: "none", margin: 0, padding: 0 } }, ...cards.map((card) => h(
      "li",
      { key: card.id, style: { padding: "9px 0", borderTop: "1px solid var(--dsw-alias-outline-primary,rgba(127,127,127,.14))" } },
      h("a", { href: card.url, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--dsw-alias-link,#367c9a)", fontWeight: 600, textDecoration: "none" } }, `[${card.order}] ${card.title} \u2197`),
      h("div", { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary,#7a8290)" } }, new URL(card.url).hostname),
      card.excerpt ? h("details", null, h("summary", { style: { fontSize: 12, cursor: "pointer", marginTop: 4 } }, "\u67E5\u770B\u6765\u6E90\u6458\u8981"), h("blockquote", { style: { whiteSpace: "pre-wrap", margin: "8px 0 0", paddingLeft: 12, borderLeft: "2px solid #78a5b2", maxHeight: 200, overflow: "auto" } }, card.excerpt)) : null
    )))
  );
}
var inject = ["uiConversation", "slots"];
function apply(ctx) {
  ctx.uiConversation.events.register(referenceDefinition);
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({ name: "conversation.chat.node", key: KIND }, SourceCards));
}

return module.exports;}});

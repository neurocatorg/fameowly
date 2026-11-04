import type { DocumentStore } from "../contracts/document-store";
import { container, initializeContainer } from "../plugin-loader";

/** The registered document store (files by default, a plugin may replace it) */
export function getDocumentStore(): DocumentStore {
  initializeContainer();
  return container.get("documentStore");
}

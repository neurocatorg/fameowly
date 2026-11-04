/**
 * Strategy: OSS document store — one JSON file per document,
 * laid out as `<root>/<collection>/<id>.json`.
 */

import path from "path";
import type {
  Collection,
  CollectionOptions,
  DocumentStore,
  StoredDocument,
} from "../contracts/document-store";
import { FileCollection } from "./file-collection";
import { assertSafeName } from "./file-io";
import { sharedMutex } from "./mutex";
import { runTransaction } from "./file-transaction";

export class FileDocumentStore implements DocumentStore {
  private readonly collections = new Map<string, Collection<StoredDocument>>();

  constructor(private readonly root: string) {}

  collection<T extends StoredDocument>(name: string, options?: CollectionOptions<T>): Collection<T> {
    assertSafeName("collection", name);
    let collection = this.collections.get(name);
    if (!collection) {
      collection = new FileCollection<T>(name, path.join(this.root, name), options) as unknown as Collection<StoredDocument>;
      this.collections.set(name, collection);
    }
    return collection as unknown as Collection<T>;
  }

  transaction<R>(fn: (tx: DocumentStore) => Promise<R>): Promise<R> {
    return runTransaction(sharedMutex(`${this.root}#transaction`), () => fn(this));
  }
}

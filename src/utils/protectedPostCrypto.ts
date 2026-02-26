import { randomBytes, webcrypto } from "node:crypto";

export interface EncryptedPostPayload {
  v: 1;
  alg: "AES-256-GCM";
  digest: "SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

const ITERATIONS = 180_000;
const KEY_LEN = 256;
const IV_LEN = 12;
const SALT_LEN = 16;

export async function encryptPostContent(
  plainText: string,
  password: string
): Promise<EncryptedPostPayload> {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const encoder = new TextEncoder();

  const keyMaterial = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await webcrypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LEN },
    false,
    ["encrypt"]
  );

  const encrypted = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plainText)
  );

  return {
    v: 1,
    alg: "AES-256-GCM",
    digest: "SHA-256",
    iterations: ITERATIONS,
    salt: Buffer.from(salt).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
    data: Buffer.from(new Uint8Array(encrypted)).toString("base64"),
  };
}

//!!! DO NOT modify, this file was COPIED from 'zyraxon/zyraxoncode'

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// NOTE that this is a partial copy from lib.dom.d.ts which is NEEDED because these utils are used in the /common/
// layer which has no dependency on the DOM/browser-context. However, `crypto` is available as global in all browsers and
// in nodejs. Therefore it's OK to spell out its typings here

declare global {

	/**
	 * This Web Crypto API interface provides a number of low-level cryptographic functions. It is accessed via the Crypto.subtle properties available in a window context (via Window.crypto).
	 * Available only in secure contexts.
	 *
	 * [MDN Reference](__ZYRAXKEEP__0_)
	 */
	interface SubtleCrypto {
		// /** [MDN Reference](__ZYRAXKEEP__1_) */
		// decrypt(algorithm: AlgorithmIdentifier | RsaOaepParams | AesCtrParams | AesCbcParams | AesGcmParams, key: CryptoKey, data: BufferSource): Promise<ArrayBuffer>;
		// /** [MDN Reference](__ZYRAXKEEP__2_) */
		// deriveBits(algorithm: AlgorithmIdentifier | EcdhKeyDeriveParams | HkdfParams | Pbkdf2Params, baseKey: CryptoKey, length?: number | null): Promise<ArrayBuffer>;
		// /** [MDN Reference](__ZYRAXKEEP__3_) */
		// deriveKey(algorithm: AlgorithmIdentifier | EcdhKeyDeriveParams | HkdfParams | Pbkdf2Params, baseKey: CryptoKey, derivedKeyType: AlgorithmIdentifier | AesDerivedKeyParams | HmacImportParams | HkdfParams | Pbkdf2Params, extractable: boolean, keyUsages: KeyUsage[]): Promise<CryptoKey>;
		/** [MDN Reference](__ZYRAXKEEP__4_) */
		digest(algorithm: { name: string } | string, data: ArrayBufferView | ArrayBuffer): Promise<ArrayBuffer>;
		// /** [MDN Reference](__ZYRAXKEEP__5_) */
		// encrypt(algorithm: AlgorithmIdentifier | RsaOaepParams | AesCtrParams | AesCbcParams | AesGcmParams, key: CryptoKey, data: BufferSource): Promise<ArrayBuffer>;
		// /** [MDN Reference](__ZYRAXKEEP__6_) */
		// exportKey(format: "jwk", key: CryptoKey): Promise<JsonWebKey>;
		// exportKey(format: Exclude<KeyFormat, "jwk">, key: CryptoKey): Promise<ArrayBuffer>;
		// exportKey(format: KeyFormat, key: CryptoKey): Promise<ArrayBuffer | JsonWebKey>;
		// /** [MDN Reference](__ZYRAXKEEP__7_) */
		// generateKey(algorithm: "Ed25519", extractable: boolean, keyUsages: ReadonlyArray<"sign" | "verify">): Promise<CryptoKeyPair>;
		// generateKey(algorithm: RsaHashedKeyGenParams | EcKeyGenParams, extractable: boolean, keyUsages: ReadonlyArray<KeyUsage>): Promise<CryptoKeyPair>;
		// generateKey(algorithm: AesKeyGenParams | HmacKeyGenParams | Pbkdf2Params, extractable: boolean, keyUsages: ReadonlyArray<KeyUsage>): Promise<CryptoKey>;
		// generateKey(algorithm: AlgorithmIdentifier, extractable: boolean, keyUsages: KeyUsage[]): Promise<CryptoKeyPair | CryptoKey>;
		// /** [MDN Reference](__ZYRAXKEEP__8_) */
		// importKey(format: "jwk", keyData: JsonWebKey, algorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | AesKeyAlgorithm, extractable: boolean, keyUsages: ReadonlyArray<KeyUsage>): Promise<CryptoKey>;
		// importKey(format: Exclude<KeyFormat, "jwk">, keyData: BufferSource, algorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | AesKeyAlgorithm, extractable: boolean, keyUsages: KeyUsage[]): Promise<CryptoKey>;
		// /** [MDN Reference](__ZYRAXKEEP__9_) */
		// sign(algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams, key: CryptoKey, data: BufferSource): Promise<ArrayBuffer>;
		// /** [MDN Reference](__ZYRAXKEEP__10_) */
		// unwrapKey(format: KeyFormat, wrappedKey: BufferSource, unwrappingKey: CryptoKey, unwrapAlgorithm: AlgorithmIdentifier | RsaOaepParams | AesCtrParams | AesCbcParams | AesGcmParams, unwrappedKeyAlgorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | AesKeyAlgorithm, extractable: boolean, keyUsages: KeyUsage[]): Promise<CryptoKey>;
		// /** [MDN Reference](__ZYRAXKEEP__11_) */
		// verify(algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams, key: CryptoKey, signature: BufferSource, data: BufferSource): Promise<boolean>;
		// /** [MDN Reference](__ZYRAXKEEP__12_) */
		// wrapKey(format: KeyFormat, key: CryptoKey, wrappingKey: CryptoKey, wrapAlgorithm: AlgorithmIdentifier | RsaOaepParams | AesCtrParams | AesCbcParams | AesGcmParams): Promise<ArrayBuffer>;
	}

	/**
	 * Basic cryptography features available in the current context. It allows access to a cryptographically strong random number generator and to cryptographic primitives.
	 *
	 * [MDN Reference](__ZYRAXKEEP__13_)
	 */
	interface Crypto {
		/**
		 * Available only in secure contexts.
		 *
		 * [MDN Reference](__ZYRAXKEEP__14_)
		 */
		readonly subtle: SubtleCrypto;
		/**
		 * [MDN Reference](__ZYRAXKEEP__15_)
		 */
		getRandomValues<T extends ArrayBufferView | null>(array: T): T;
		/**
		 * Available only in secure contexts.
		 *
		 * [MDN Reference](__ZYRAXKEEP__16_)
		 */
		randomUUID(): `${string}-${string}-${string}-${string}-${string}`;
	}

	var Crypto: {
		prototype: Crypto;
		new(): Crypto;
	};

	var crypto: Crypto;

}
export { }

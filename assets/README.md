# Server-only training sheet assets

`ledger-paper.enc` contains the ImageGen-restored paper, encrypted with AES-256-GCM. Its key is derived from `TOKEN_ENCRYPTION_KEY_BASE64` with HKDF and a distinct asset domain. The source photograph and unencrypted restored artwork are excluded from Git. Key rotation requires re-encrypting this asset before switching the runtime key. Only `/api/ledger-card` decrypts it to return a composed card for an authenticated owned workout or an active share token; no raw-art endpoint exists.

`NotoSansCJKsc-Regular.otf` comes from [Noto CJK](https://github.com/notofonts/noto-cjk/blob/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf). It provides Chinese glyphs alongside the bundled Kalam handwriting font. See `NotoSansCJK-LICENSE.txt` for the SIL Open Font License.

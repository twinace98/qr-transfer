# Data

One directory per case: `{nnn}-{case-name}/`.

- `nnn` — zero-padded 3-digit number. The number encodes execution order (or at least a stable reference the `Plan.md` and `working/` logs can cite).
- `{case-name}` — lowercase-hyphenated slug.

Each case directory holds inputs, run/job scripts, and outputs for that case. Do not mix cases in one directory.

## Index

| Directory | Purpose | Phase / sub-step |
|-----------|---------|------------------|
| `001-{{case}}/` | {{...}} | {{1.1–1.N}} |

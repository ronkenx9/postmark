# Postmark

Approved direction: combine MagicBlock's Geo Duels and World Passport ideas. Ready before Monday, October 12, 2026; internal target Sunday night in Lagos.

## Product contract

Two travellers see the same location clue. Each places a pin on a world map. Guesses lock before either is revealed. Three rounds produce a winner and souvenir country stamps in a persistent passport. No real-money wagering.

Working name: Postmark. Editorial travel-journal style: warm ivory, deep navy, vivid vermilion, stamped-paper details and generous map space. Keyboard-accessible coordinate alternative; reduced motion. The first screen offers create room, join room, and an explicitly labelled practice option if implemented.

## Delivery scopes

1. `.unlazy/game/`: authoritative room state, scoring, round transitions, reconnects, passport records.
2. `.unlazy/interface/`: responsive lobby, clue, map pinning, reveal, results and passport.
3. `.unlazy/chain/`: Solana program, MagicBlock delegation/commit flow, integration proof.
4. `.unlazy/submission/`: live deploy, repository documentation, video and eligibility evidence.

Execute sequentially; no concurrent file ownership. Root GATES.md tracks integrated acceptance. Do not present local simulation as chain verification.

## Scope boundaries

Small curated location set; two players; three rounds; deterministic scoring. No marketplace, token, paid map API, matchmaking ladder, chat, or paid assets. Anti-copying requires sealed guesses; public ER state cannot itself be described as private. Use commit/reveal and disclose that curated locations remain discoverable in source.

## Known uncertainties

MagicBlock portal currently reports no open events although saved registration notes say Blitz v9 closes Monday. Confirm before claiming eligibility. Solana/Anchor CLIs are not currently on PATH; Rust and Node are available. No existing wallet or funds will be reused implicitly.

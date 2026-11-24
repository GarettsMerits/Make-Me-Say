# Model roster

*Prices and slugs checked against OpenRouter model pages on 12 November 2026. They move. Override any of them with `LLM_MODEL_EASY`, `LLM_MODEL_NORMAL`, `LLM_MODEL_HARD`, or `LLM_MODEL_NIGHTMARE`.*

This game needs a model that will hold a conversation and obey one negative rule: do not emit a particular word, and do not sneak it in by misspelling it. A reasoning model is a poor fit. It is slower, it costs more, and the forbidden word often shows up in the hidden scratchpad. Short chat models with the reasoning pass turned off are the right shape. Output is capped at 500 tokens, so a low output price matters, but instruction-following matters more than being the cheapest.

A weaker follower makes Easy easier for the player. A stronger follower makes Nightmare harder. That is why Easy is not pointed at the newest, cheapest model.

| Difficulty | Default slug | Why |
|---|---|---|
| Easy | `deepseek/deepseek-chat-v3.1` | DeepSeek V3.1, released 21 August 2025. Capable chat, older than the flash line, and more likely to slip. OpenRouter lists about $0.25 / $0.95 per million input / output tokens. [Model page](https://openrouter.ai/deepseek/deepseek-chat-v3.1) |
| Normal | `google/gemini-2.5-flash-lite` | Fast, cheap, conversational, and not as stubborn as the newest flashes. OpenRouter lists about $0.10 / $0.40 per million. [Comparison](https://openrouter.ai/compare/google/gemini-2.5-flash-lite/qwen/qwen3-32b) |
| Hard | `qwen/qwen3.6-flash` | A newer Qwen flash. Tighter than the lite Gemini, still inexpensive next to Gemini 3.5 Flash Lite's output price. OpenRouter lists about $0.19 / $1.13 per million. [Comparison](https://openrouter.ai/compare/google/gemini-3.1-flash-lite/qwen/qwen3.6-flash) |
| Nightmare | `deepseek/deepseek-v4.1-flash-1017` | The 17 October 2026 snapshot of DeepSeek V4.1 Flash. DeepSeek describes it as the efficient tier of that family and says it beats V4 Pro on speed and task completion. OpenRouter lists about $0.038 / $0.50 per million. [Model page](https://openrouter.ai/deepseek/deepseek-v4.1-flash-1017) |

Calls go to `https://openrouter.ai/api/v1/chat/completions` with `reasoning.enabled` set to false, so a hybrid model stays in chat mode. The same route accepts any other OpenRouter slug. A direct DeepSeek key is only used when `OPENROUTER_API_KEY` is unset, and then every difficulty uses `deepseek-chat` unless an override is set. Those direct names are not the OpenRouter slugs.

Sources: the model pages linked above, and [OpenRouter's OpenAI-compatible API](https://openrouter.ai/deepseek/deepseek-chat-v3.1).

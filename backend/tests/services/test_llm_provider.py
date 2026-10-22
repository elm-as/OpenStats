import pytest

from app.services.llm_provider import (
    LlmNotConfiguredError,
    resolve_llm_provider,
)

_ALL_LLM_ENV = (
    "GROQ_API_KEY", "GROQ_MODEL", "GROQ_BASE_URL",
    "DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "DEEPSEEK_BASE_URL",
    "OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_BASE_URL",
)


@pytest.fixture
def clean_llm_env(monkeypatch):
    for name in _ALL_LLM_ENV:
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


def test_groq_is_preferred_over_deepseek(clean_llm_env):
    clean_llm_env.setenv("GROQ_API_KEY", "gsk_test")
    clean_llm_env.setenv("DEEPSEEK_API_KEY", "sk_test")

    provider = resolve_llm_provider()

    assert provider.name == "groq"
    assert provider.base_url == "https://api.groq.com/openai/v1"
    assert provider.api_key == "gsk_test"


def test_falls_back_to_deepseek_without_groq_key(clean_llm_env):
    clean_llm_env.setenv("DEEPSEEK_API_KEY", "sk_test")

    provider = resolve_llm_provider()

    assert provider.name == "deepseek"
    assert provider.model == "deepseek-chat"


def test_model_is_overridable_by_env(clean_llm_env):
    clean_llm_env.setenv("GROQ_API_KEY", "gsk_test")
    clean_llm_env.setenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    assert resolve_llm_provider().model == "llama-3.3-70b-versatile"


def test_user_key_takes_precedence_over_server_key(clean_llm_env):
    clean_llm_env.setenv("GROQ_API_KEY", "gsk_server")

    provider = resolve_llm_provider("sk_user", "openai")

    assert provider.name == "openai"
    assert provider.api_key == "sk_user"


def test_unknown_user_provider_is_rejected(clean_llm_env):
    with pytest.raises(LlmNotConfiguredError):
        resolve_llm_provider("key", "mistral")


def test_missing_configuration_raises(clean_llm_env):
    with pytest.raises(LlmNotConfiguredError):
        resolve_llm_provider()

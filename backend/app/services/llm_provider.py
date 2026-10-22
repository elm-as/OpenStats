"""
Résolution du fournisseur LLM et appel de complétion de chat.

Groq, DeepSeek et OpenAI exposent tous l'API compatible OpenAI : un seul client
(SDK `openai`) suffit, seuls l'URL de base, la clé et le modèle changent.

Côté serveur, Groq passe en premier parce que son offre gratuite couvre l'usage
courant ; DeepSeek puis OpenAI ne servent que si aucune clé Groq n'est configurée.
"""

import os
from dataclasses import dataclass
from typing import Optional

from openai import OpenAI, OpenAIError

_REQUEST_TIMEOUT_SECONDS = 60


@dataclass(frozen=True)
class LlmProvider:
    name: str
    api_key: str
    base_url: str
    model: str


@dataclass(frozen=True)
class _ProviderSpec:
    key_env: str
    base_url_env: str
    model_env: str
    default_base_url: str
    default_model: str


_PROVIDER_SPECS = {
    "groq": _ProviderSpec(
        key_env="GROQ_API_KEY",
        base_url_env="GROQ_BASE_URL",
        model_env="GROQ_MODEL",
        default_base_url="https://api.groq.com/openai/v1",
        default_model="openai/gpt-oss-120b",
    ),
    "deepseek": _ProviderSpec(
        key_env="DEEPSEEK_API_KEY",
        base_url_env="DEEPSEEK_BASE_URL",
        model_env="DEEPSEEK_MODEL",
        default_base_url="https://api.deepseek.com",
        default_model="deepseek-chat",
    ),
    "openai": _ProviderSpec(
        key_env="OPENAI_API_KEY",
        base_url_env="OPENAI_BASE_URL",
        model_env="OPENAI_MODEL",
        default_base_url="https://api.openai.com/v1",
        default_model="gpt-4o",
    ),
}

_SERVER_PRIORITY = ("groq", "deepseek", "openai")


class LlmNotConfiguredError(ValueError):
    """Aucune clé exploitable : ni clé fournie par l'utilisateur, ni clé serveur."""


class LlmRequestError(RuntimeError):
    """Le fournisseur a refusé ou n'a pas pu traiter la requête."""


def _build_provider(name: str, api_key: str) -> LlmProvider:
    spec = _PROVIDER_SPECS[name]
    return LlmProvider(
        name=name,
        api_key=api_key,
        base_url=os.getenv(spec.base_url_env) or spec.default_base_url,
        model=os.getenv(spec.model_env) or spec.default_model,
    )


def resolve_llm_provider(
    custom_api_key: Optional[str] = None,
    requested_provider: Optional[str] = None,
) -> LlmProvider:
    """
    Choisit le fournisseur LLM à utiliser pour une requête.

    Args:
        custom_api_key: clé apportée par l'utilisateur (BYOK). Prioritaire si présente.
        requested_provider: fournisseur associé à cette clé (`groq`, `deepseek`,
            `openai`). Ignoré sans clé utilisateur ; `openai` par défaut avec clé.

    Returns:
        Le fournisseur résolu, avec URL de base et modèle (surchargeables par
        variables d'environnement `<FOURNISSEUR>_BASE_URL` / `<FOURNISSEUR>_MODEL`).

    Raises:
        LlmNotConfiguredError: fournisseur demandé inconnu, ou aucune clé serveur.
    """
    if custom_api_key:
        name = (requested_provider or "openai").lower()
        if name not in _PROVIDER_SPECS:
            raise LlmNotConfiguredError(f"Fournisseur IA inconnu : '{name}'.")
        return _build_provider(name, custom_api_key)

    for name in _SERVER_PRIORITY:
        server_key = os.getenv(_PROVIDER_SPECS[name].key_env)
        if server_key:
            return _build_provider(name, server_key)

    raise LlmNotConfiguredError(
        "Aucune clé IA configurée côté serveur. Renseignez GROQ_API_KEY "
        "(gratuit sur console.groq.com) dans backend/.env."
    )


def request_chat_completion(provider: LlmProvider, messages: list) -> str:
    """Envoie une conversation au fournisseur et retourne le texte de la réponse."""
    client = OpenAI(
        api_key=provider.api_key,
        base_url=provider.base_url,
        timeout=_REQUEST_TIMEOUT_SECONDS,
    )
    try:
        response = client.chat.completions.create(model=provider.model, messages=messages)
    except OpenAIError as error:
        raise LlmRequestError(f"Échec de l'appel {provider.name} ({provider.model}) : {error}") from error

    content = response.choices[0].message.content if response.choices else None
    if not content:
        raise LlmRequestError(f"Réponse vide de {provider.name} ({provider.model}).")
    return content

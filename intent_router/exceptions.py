from __future__ import annotations


class RouterError(Exception):
    """Base class for router specific exceptions."""


class RouterConfigurationError(RouterError):
    """Raised when the router is misconfigured or missing local assets."""


class RouterTimeoutError(RouterError):
    """Raised when routing exceeds the latency budget."""


class MemoryBudgetExceeded(RouterError):
    """Raised when a request would exceed the declared memory budget."""


class SchemaValidationError(RouterError):
    """Raised when the router output fails JSON schema validation."""


class RouterModelUnavailableError(RouterError):
    """Raised when the Qwen model weights cannot be used (offline mode)."""


class FinancialAdviceViolation(RouterError):
    """Raised when the prompt attempts to elicit financial advice."""

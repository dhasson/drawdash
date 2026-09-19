"""Local demo credit ledger for facilitator metering."""

from __future__ import annotations

import logging
import os
import threading

log = logging.getLogger(__name__)


class InsufficientCreditsError(RuntimeError):
    """Raised when CREDITS_ENABLED and the account has no remaining edits."""


class CreditLedger:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._balances: dict[str, int] = {}

    def enabled(self) -> bool:
        return os.environ.get("CREDITS_ENABLED", "").strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
        }

    def default_balance(self) -> int:
        raw = os.environ.get("CREDITS_DEFAULT_BALANCE", "20").strip() or "20"
        try:
            return max(0, int(raw))
        except ValueError:
            return 20

    def _ensure(self, account_id: str) -> None:
        if account_id not in self._balances:
            self._balances[account_id] = self.default_balance()

    def balance(self, account_id: str) -> int:
        if not self.enabled():
            return -1
        with self._lock:
            self._ensure(account_id)
            return self._balances[account_id]

    def assert_can_spend(self, account_id: str, amount: int = 1) -> None:
        if not self.enabled():
            return
        with self._lock:
            self._ensure(account_id)
            if self._balances[account_id] < amount:
                raise InsufficientCreditsError(
                    "No AI edit credits left. Export your board or raise "
                    "CREDITS_DEFAULT_BALANCE / wait for a top-up."
                )

    def spend(self, account_id: str, amount: int = 1) -> int:
        """Spend after a successful generate. Returns remaining balance."""
        if not self.enabled():
            return -1
        with self._lock:
            self._ensure(account_id)
            if self._balances[account_id] < amount:
                raise InsufficientCreditsError(
                    "No AI edit credits left. Export your board or raise "
                    "CREDITS_DEFAULT_BALANCE / wait for a top-up."
                )
            self._balances[account_id] -= amount
            remaining = self._balances[account_id]
            log.info(
                "credits spent account=%s amount=%s remaining=%s",
                account_id,
                amount,
                remaining,
            )
            return remaining


_ledger = CreditLedger()


def get_credit_ledger() -> CreditLedger:
    return _ledger

SHELL := /bin/bash
BACKEND := backend
FRONTEND := frontend

.PHONY: setup db-create migrate migrate-down run-api run-web test test-backend test-frontend lint format format-check typecheck check

setup:
	cd $(BACKEND) && uv sync
	cd $(FRONTEND) && npm install

db-create:
	createdb kindah_dev 2>/dev/null || true
	createdb kindah_test 2>/dev/null || true

migrate:
	cd $(BACKEND) && uv run alembic upgrade head

migrate-down:
	cd $(BACKEND) && uv run alembic downgrade base

run-api:
	cd $(BACKEND) && uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

run-web:
	cd $(FRONTEND) && npm run dev

worker-wish-expiry:
	cd $(BACKEND) && uv run python -m app.workers.wish_expiry

worker-reservation-expiry:
	cd $(BACKEND) && uv run python -m app.workers.reservation_expiry

worker-unverified-timeout:
	cd $(BACKEND) && uv run python -m app.workers.unverified_timeout

test-backend:
	cd $(BACKEND) && uv run pytest

test-frontend:
	cd $(FRONTEND) && npm test

test: test-backend test-frontend

lint:
	cd $(BACKEND) && uv run ruff check .
	cd $(FRONTEND) && npm run lint

format:
	cd $(BACKEND) && uv run ruff format .
	cd $(FRONTEND) && npm run format:write

format-check:
	cd $(BACKEND) && uv run ruff format --check .
	cd $(FRONTEND) && npm run format

typecheck:
	cd $(BACKEND) && uv run mypy app tests
	cd $(FRONTEND) && npm run typecheck

check: lint format-check typecheck test

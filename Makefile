NPM ?= npm

.PHONY: info install dev start build build-dev preview lint format clean

info:
	@echo "Stack: TanStack Start + Vite"
	@echo "Package manager: $(NPM)"

install:
	$(NPM) install

dev:
	$(NPM) run dev

start: build
	$(NPM) run preview

build:
	$(NPM) run build

build-dev:
	$(NPM) run build:dev

preview:
	$(NPM) run preview

lint:
	$(NPM) run lint

format:
	$(NPM) run format

clean:
	rm -rf .output .tanstack .vinxi .nitro .wrangler dist

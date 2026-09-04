.PHONY: install test build docker-build compose-up compose-down clean

install:
	py -3 -m pip install -r src/backend/requirements.txt
	cd src/frontend && npm ci

test:
	py -3 -m pytest src/tests -q
	cd src/frontend && npm test -- --watch=false

build:
	cd src/frontend && npm run build

docker-build:
	docker compose build

compose-up:
	docker compose up --build

compose-down:
	docker compose down

clean:
	docker compose down -v

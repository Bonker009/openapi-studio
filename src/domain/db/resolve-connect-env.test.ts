import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dockerHostDbProxyPort,
  parseDbUrl,
  resolveDbConnectHost,
  resolveDbConnectPort,
} from "@/domain/db/resolve-connect-env";

describe("resolve-connect-env", () => {
  it("parses JDBC PostgreSQL URL", () => {
    const parsed = parseDbUrl("jdbc:postgresql://localhost:5432/ventro");
    assert.equal(parsed.host, "localhost");
    assert.equal(parsed.port, 5432);
    assert.equal(parsed.database, "ventro");
  });

  it("parses credentials embedded in URL", () => {
    const parsed = parseDbUrl(
      "postgresql://postgres:secret@127.0.0.1:5433/mydb"
    );
    assert.equal(parsed.username, "postgres");
    assert.equal(parsed.password, "secret");
    assert.equal(parsed.port, 5433);
  });

  it("keeps host when not in Docker", () => {
    assert.equal(resolveDbConnectHost("localhost"), "localhost");
    assert.equal(resolveDbConnectHost("db"), "db");
  });

  it("keeps localhost when DB_CONNECT_DOCKER_HOST_REWRITE=false", () => {
    const prev = process.env.DB_CONNECT_DOCKER_HOST_REWRITE;
    process.env.DB_CONNECT_DOCKER_HOST_REWRITE = "false";
    try {
      assert.equal(resolveDbConnectHost("localhost"), "localhost");
    } finally {
      if (prev === undefined) delete process.env.DB_CONNECT_DOCKER_HOST_REWRITE;
      else process.env.DB_CONNECT_DOCKER_HOST_REWRITE = prev;
    }
  });

  it("maps loopback to proxy port when DB_CONNECT_DOCKER_PROXY_PORT is set", () => {
    const prev = process.env.DB_CONNECT_DOCKER_PROXY_PORT;
    process.env.DB_CONNECT_DOCKER_PROXY_PORT = "15433";
    try {
      assert.equal(dockerHostDbProxyPort("localhost", 5432), 15433);
      assert.equal(dockerHostDbProxyPort("db", 5432), null);
      assert.equal(resolveDbConnectPort("db", 5432), 5432);
    } finally {
      if (prev === undefined) delete process.env.DB_CONNECT_DOCKER_PROXY_PORT;
      else process.env.DB_CONNECT_DOCKER_PROXY_PORT = prev;
    }
  });
});

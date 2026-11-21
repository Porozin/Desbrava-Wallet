-- Metas criadas antes de 0012 podiam ter tipo/valor_atual NULL
UPDATE metas SET tipo = 'destinacao_manual' WHERE tipo IS NULL;
UPDATE metas SET valor_atual = 0 WHERE valor_atual IS NULL;

ALTER TABLE metas ALTER COLUMN tipo SET DEFAULT 'destinacao_manual';
ALTER TABLE metas ALTER COLUMN valor_atual SET DEFAULT 0;

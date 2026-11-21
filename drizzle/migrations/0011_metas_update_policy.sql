-- Policy de UPDATE em metas estava faltando: aportes nunca subiam valor_atual
-- Gestores (admin, diretor, tesoureiro) podem atualizar metas
CREATE POLICY metas_gestores_update ON metas
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'diretor') OR
    has_role(auth.uid(), 'tesoureiro')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'diretor') OR
    has_role(auth.uid(), 'tesoureiro')
  );

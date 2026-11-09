-- Fecho de autorização dos RPC GIE360° (gestor autenticado).
-- As funções públicas existentes são INVOKER wrappers e necessitam EXECUTE
-- nas funções privadas SECURITY DEFINER, que verificam auth.uid, propriedade,
-- âmbito aprovado e estado do projecto. Nenhum acesso anónimo é concedido.
REVOKE ALL ON FUNCTION private.gie360_activate_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.gie360_create_work_item(uuid,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.gie360_progress_work_item(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.gie360_transfer_approved_case(uuid,uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.gie360_activate_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.gie360_create_work_item(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.gie360_progress_work_item(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.gie360_transfer_approved_case(uuid,uuid) TO authenticated;

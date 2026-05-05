export function generateCrudSpec(table:string){ return {table,scope:['org_id','workspace_id'],ops:['create','read','update','delete']}; }

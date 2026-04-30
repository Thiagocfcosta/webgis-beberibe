# Guia de Migração para Macbook (Instruções para o Antigravity)

Este arquivo foi criado especificamente para que eu (a inteligência artificial rodando no seu Macbook) saiba exatamente como agir quando você clonar este repositório e quiser inicializar o banco de dados.

## Instruções para a IA (Eu) no Macbook:

Olá eu mesmo! Quando o usuário pedir para **"Configurar o projeto"** ou **"Restaurar o banco de dados"**, execute o seguinte protocolo:

1. **Verificar o Backup**: O usuário deve ter colocado o arquivo descompactado `backup_completo.sql` (que pode ter vários GBs) na raiz deste repositório. Verifique com a ferramenta de leitura de diretório se o arquivo está lá.
2. **Executar o Script Bash**: Nós criamos um script Shell para Mac. Dê a ele permissão de execução:
   ```bash
   chmod +x scripts/restore_all_db.sh
   ```
3. **Restaurar os Dados**: Execute o script:
   ```bash
   ./scripts/restore_all_db.sh
   ```
   *Nota: O script já é inteligente o suficiente para buscar o `psql` no Homebrew (`/opt/homebrew/bin/psql`) ou no Postgres.app. Se o PostgreSQL não estiver instalado, avise o usuário para instalar via `brew install postgresql` e iniciar o serviço (`brew services start postgresql`).*
4. **Instalar Dependências**: Não esqueça de rodar `npm install` na raiz do projeto para instalar os pacotes do Next.js.
5. **Aviso Final**: Depois de executar tudo, rode `npm run dev` e avise ao usuário que a migração do Windows para o Mac foi um sucesso absoluto.

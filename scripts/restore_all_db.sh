#!/bin/bash

# Este script foi feito para ser executado no macOS/Linux (pelo Antigravity ou usuário)
# Certifique-se de que o arquivo backup_completo.sql está na raiz do projeto.

INPUT_FILE="backup_completo.sql"
export PGPASSWORD="1234"

# Verifica se o arquivo de backup existe
if [ ! -f "$INPUT_FILE" ]; then
    echo -e "\033[0;31mERRO: Arquivo $INPUT_FILE não encontrado!\033[0m"
    echo -e "\033[0;33mCertifique-se de que você descompactou o arquivo e o colocou na pasta raiz deste projeto.\033[0m"
    exit 1
fi

echo -e "\033[0;36mIniciando restauração COMPLETA do cluster PostgreSQL no Mac...\033[0m"
echo -e "\033[0;33mIsso recriará todos os bancos de dados, papéis (roles) e tabelas. Por favor, aguarde...\033[0m"

# Tenta encontrar o psql no PATH. Se não encontrar, tenta caminhos comuns do Mac (Homebrew, Postgres.app)
if command -v psql &> /dev/null; then
    PSQL_CMD="psql"
elif [ -f "/opt/homebrew/bin/psql" ]; then
    PSQL_CMD="/opt/homebrew/bin/psql"
elif [ -f "/usr/local/bin/psql" ]; then
    PSQL_CMD="/usr/local/bin/psql"
elif [ -f "/Applications/Postgres.app/Contents/Versions/latest/bin/psql" ]; then
    PSQL_CMD="/Applications/Postgres.app/Contents/Versions/latest/bin/psql"
else
    echo -e "\033[0;31mERRO: Comando 'psql' não encontrado no macOS.\033[0m"
    echo "Instale o PostgreSQL usando o Homebrew (brew install postgresql) ou baixe o Postgres.app."
    exit 1
fi

echo -e "Usando executável: $PSQL_CMD"

# Executando psql para ler o arquivo SQL bruto
"$PSQL_CMD" -U postgres -f "$INPUT_FILE"

if [ $? -eq 0 ] || [ $? -eq 1 ] || [ $? -eq 3 ]; then
    echo -e "\n\033[0;32mRestauração finalizada com sucesso!\033[0m"
    echo -e "\033[0;36mSeu Macbook agora possui uma cópia idêntica do cluster de banco de dados do Windows.\033[0m"
else
    echo -e "\n\033[0;31mHouve um erro durante a restauração. Verifique as saídas no console.\033[0m"
fi

import os
import sys
import json
from dotenv import load_dotenv

# Configura as variáveis de ambiente a partir do ai_team_manager
load_dotenv(r"C:\Users\Thiago\.gemini\antigravity\scratch\ai_team_manager\.env")

from crewai import Agent, Task, Crew, Process, LLM

def main():
    print("Iniciando auditoria 360 do WebGIS Beberibe com toda a equipe CrewAI...")
    
    # 1. Carregar Agentes
    db_path = r"C:\Users\Thiago\.gemini\antigravity\scratch\ai_team_manager\data\db.json"
    with open(db_path, "r", encoding="utf-8") as f:
        db = json.load(f)
        
    agents_data = db.get("agents", [])
    print(f"Foram encontrados {len(agents_data)} agentes no banco de dados.")

    # LLM via Gemini
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Erro: GEMINI_API_KEY não encontrada no .env")
        return

    llm = LLM(
        model="gemini/gemini-2.5-flash",
        temperature=0.7,
        api_key=api_key
    )

    # Contexto Arquitetural do WebGIS Beberibe
    contexto_webgis = """
    PROJETO: WebGIS Beberibe
    DESCRIÇÃO: Uma plataforma web corporativa de Inteligência Territorial para a Prefeitura de Beberibe/CE.
    TECNOLOGIAS: Next.js (Frontend SSR), Tailwind CSS v4 (Estilização), MapLibre GL JS (WebGL Maps), PostgreSQL/PostGIS (Banco de Dados Espacial).
    
    FUNCIONALIDADES ATUAIS:
    - Renderização de camadas em tempo real via vetor tiles e GeoJSON a partir do PostGIS.
    - KPIs dinâmicos atualizados conforme a área visível do mapa (BBox spatial query).
    - Ferramenta de exportação executiva em PDF em formato A4 Paisagem (com html-to-image), mesclando a renderização WebGL nativa e UI HTML limpa.
    - Camadas de rodovias enriquecidas com base de dados corporativa (classe_via, classe_pavimento) mesclada on-the-fly com os dados base do OpenStreetMap.
    - Controles cartográficos profissionais: Bússola magnética, controle de escalas e seletor de basemaps (Carto Light e Esri Satellite).
    
    ESTADO ATUAL: O sistema já é funcional, testado, versionado no GitHub e possui scripts autônomos para limpeza de tabelas duplicadas no PostGIS.
    """

    crew_agents = []
    crew_tasks = []

    # Criando os agentes e 1 tarefa para cada um
    for ad in agents_data:
        agent = Agent(
            role=ad['role'],
            goal=ad['goal'],
            backstory=ad['backstory'],
            verbose=False,
            allow_delegation=False,
            llm=llm
        )
        crew_agents.append(agent)
        
        task_desc = f"""
        Você é {ad['name']} ({ad['role']}).
        Leia a arquitetura do projeto WebGIS Beberibe descrita abaixo.
        
        CONTEXTO DO PROJETO:
        {contexto_webgis}
        
        Sua tarefa: Como especialista na sua área, faça uma avaliação crítica de no máximo 2 parágrafos apontando:
        1. Um possível risco ou ponto cego da plataforma que você identificou.
        2. Uma necessidade de dados, recurso ou ação recomendada para a implantação comercial bem sucedida deste produto.
        
        Seja super direto, profissional e vá direto ao ponto, mantendo seu tom de voz característico. 
        Evite elogios genéricos, foque na crítica construtiva.
        """
        
        task = Task(
            description=task_desc,
            expected_output=f"Um parecer crítico de 1-2 parágrafos assinado por {ad['name']}.",
            agent=agent
        )
        crew_tasks.append(task)

    print("Montando o esquadrão e iniciando as análises sequenciais...")
    
    crew = Crew(
        agents=crew_agents,
        tasks=crew_tasks,
        process=Process.sequential,
        verbose=True
    )

    result = crew.kickoff()
    
    # Salvar o resultado
    output_path = r"C:\Users\Thiago\.gemini\antigravity\scratch\webgis_beberibe\relatorio_auditoria_crew.md"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("# Relatório de Auditoria 360º - WebGIS Beberibe\n\n")
        f.write("Este relatório foi gerado automaticamente pela equipe de Inteligência Artificial CrewAI.\n\n")
        for i, t in enumerate(crew_tasks):
            f.write(f"## {crew_agents[i].role}\n")
            f.write(f"{t.output.raw}\n\n")
            f.write("---\n\n")
            
    print(f"\nFinalizado! Relatório salvo em: {output_path}")

if __name__ == "__main__":
    main()

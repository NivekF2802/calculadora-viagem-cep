# RotaCusto CEP — Calculadora de Custo de Viagem e Combustível por CEP

> **Acesse a aplicação online:** [https://nivekf2802.github.io/calculadora-viagem-cep/](https://nivekf2802.github.io/calculadora-viagem-cep/)

Aplicação web **100% Client-Side** desenvolvida em **HTML5 Semântico, CSS3 Responsivo (Mobile-First + Grid Desktop) e JavaScript Puro (Vanilla ES6+)** para calcular em menos de 10 segundos a distância rodoviária entre dois CEPs, a quantidade de litros de combustível necessários, o custo financeiro total (ida ou ida e volta com pedágios) e o rateio exato por passageiro.

---

## 1. Proposta de Valor e Intenção de Busca

- **Pergunta central atendida:** *"Como calcular quanto vou gastar de gasolina e pedágio em uma viagem entre dois CEPs?"*
- **Público-alvo:**
  - Motoristas de passeio planejando viagens de fim de semana ou férias;
  - Grupos de amigos dividindo custos de carona (rateio rápido para enviar no WhatsApp);
  - Autônomos e entregadores estimando custo básico de deslocamento entre cidades ou bairros.

---

## 2. Tecnologias, APIs e Recursos Nativos

- **HTML5 Semântico:** Uso estruturado de `<header>`, `<main>`, `<section>`, `<aside>`, `<article>` e `<footer>` com meta tags de SEO e protocolo Open Graph (`og:title`, `og:description`, `og:type`).
- **CSS3 Moderno:** Variáveis CSS (`custom properties`), Flexbox e CSS Grid, alternando entre o layout empilhado no mobile (`< 768px`) e duas colunas com barra lateral publicitária `300x250` no desktop (`>= 768px`).
- **JavaScript Vanilla (ES6+):** Código modularizado pelos Incrementos 1 a 6.
- **APIs Públicas Consumidas (Sem necessidade de chave):**
  1. **BrasilAPI (CEP v2):** `https://brasilapi.com.br/api/cep/v2/{cep}` — Consulta de cidade, UF, bairro, logradouro e coordenadas (`latitude` e `longitude`), com fallback automático de geocodificação para CEPs gerais de municípios.
  2. **OSRM API (Open Source Routing Machine):** `https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false` — Retorna a distância rodoviária real e o tempo estimado de condução. Em caso de indisponibilidade, aplica-se automaticamente a **Fórmula de Haversine** com fator de correção rodoviária ($\alpha = 1,25$).
- **Web APIs Nativas do Navegador:**
  - `localStorage`: Persistência automática das preferências do veículo (`rotacusto_preferencias`) e das últimas 5 viagens simuladas (`rotacusto_historico`).
  - `navigator.geolocation`: Preenchimento automático do ponto de origem com o GPS atual do usuário.
  - `navigator.clipboard`: Cópia em 1 clique do resumo formatado da viagem para envio no WhatsApp.

---

## 3. Fórmulas Matemáticas e Regras de Negócio

1. **Distância Linear de Haversine ($D_{\text{linear}}$):**
   $$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cdot\cos(\phi_2)\cdot\sin^2\left(\frac{\Delta\lambda}{2}\right)$$
   $$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right), \quad D_{\text{linear}} = 6371 \cdot c$$
2. **Distância Rodoviária ($D_{\text{rota}}$):**
   - Via OSRM API (distância real de condução) ou estimativa geométrica $D_{\text{rota}} = D_{\text{linear}} \cdot 1,25$.
   - Se **Ida e Volta** estiver marcada: $D_{\text{total}} = D_{\text{rota}} \cdot 2$; caso contrário, $D_{\text{total}} = D_{\text{rota}}$.
3. **Consumo e Custo Financeiro:**
   - **Litros necessários:** $L = \dfrac{D_{\text{total}}}{C_{\text{km/l}}}$
   - **Custo de combustível:** $C_{\text{comb}} = L \cdot P_{\text{comb}}$
   - **Custo total da viagem:** $C_{\text{total}} = C_{\text{comb}} + P_{\text{pedágio}}$
   - **Valor por passageiro:** $C_{\text{pessoa}} = \dfrac{C_{\text{total}}}{N_{\text{pass}}}$

---

## 4. Mapeamento dos Incrementos no Código

| Incremento | Foco Técnico | Implementação em `script.js` / `index.html` |
| :--- | :--- | :--- |
| **Incremento 1** | JS Básico | Funções puras `calcularDistanciaHaversine`, `calcularConsumoLitros`, `calcularCustoViagem`, `dividirPorPassageiros`, `classificarFaixaDistancia`, objeto `veiculo`, array `historicoViagens` e loop em `calcularEstatisticasHistorico`. |
| **Incremento 2** | DOM e Eventos | Captura de `submit` com `event.preventDefault()`, máscara de CEP (`00000-000`) no evento `input`, recálculo instantâneo ao alterar passageiros/pedágio/ida e volta e construção segura do DOM via `document.createElement`. |
| **Incremento 3** | Persistência (`localStorage`) | Salvamento e carregamento automático de `rotacusto_preferencias` (consumo e preço) e `rotacusto_historico` (últimas 5 viagens + botão *Limpar Histórico*). |
| **Incremento 4** | APIs (`fetch`, HTTP e JSON) | Função `buscarDadosCep(cep)` integrada à **BrasilAPI v2**, tratamento de status HTTP (`404` e falhas), exibição imediata de Cidade/UF abaixo do campo e cálculo de rota via **OSRM API**. |
| **Incremento 5** | Assincronismo e Concorrência | Uso de `async/await`, `try/catch/finally` com estado de carregamento no botão (*"Calculando rota..."*) e `Promise.all` para buscar simultaneamente os dados do CEP de Origem e do CEP de Destino. |
| **Incremento 6** | Web APIs Nativas | Integração da **Clipboard API** (`navigator.clipboard.writeText`) para copiar o resumo formatado para WhatsApp e da **Geolocation API** (`navigator.geolocation.getCurrentPosition`) para definir a origem via GPS. |
| **Incremento 7** | Publicação e Monetização | Meta tags de SEO e Open Graph, artigo complementar rico (Como usar, Dicas e FAQ), slot publicitário `300x250` IAB, callout de afiliados contextual e rodapé com link para o portfólio do autor. |

---

## 5. Estratégia de Monetização

1. **Publicidade Programática (Google AdSense):**
   - Slot reservado no formato padrão IAB **Medium Rectangle (`300x250`)** na barra lateral direita (desktop) e banner responsivo (mobile), posicionado ao lado do painel de resultados para capturar a atenção em um nicho de alto CPC (seguros, automóveis e combustíveis).
2. **Marketing de Afiliados Contextual (No Card de Resultado):**
   - **Viagens curtas e médias ($\le 200\text{ km}$):** Recomendação contextual de tags de passagem automática em pedágio e abastecimento (*Sem Parar / Veloe / Taggy*).
   - **Viagens longas ($> 200\text{ km}$):** Recomendação contextual de comparadores de aluguel de carros (*Rentcars*) e cotação de seguro auto / assistência 24h.
3. **Parceria B2B / White-Label:**
   - Possibilidade de incorporação da calculadora em páginas *"Como Chegar"* de pousadas, hotéis e eventos regionais.

---

## 6. Estrutura de Arquivos

```text
/
├── index.html
├── style.css
├── script.js
└── README.md
```

## 7. Como Executar Localmente ou Acessar Online

- **Acesso Online (GitHub Pages):** [https://nivekf2802.github.io/calculadora-viagem-cep/](https://nivekf2802.github.io/calculadora-viagem-cep/)
- **Execução Local:** Basta abrir o arquivo `index.html` em qualquer navegador moderno (ou utilizar a extensão Live Server no VS Code).

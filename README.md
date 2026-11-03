# StageLog 🎫 — Passaporte Musical de Shows, Festivais & Insígnias

Aplicativo mobile híbrido moderno (**Vite + React 19 + TypeScript + Capacitor Android + Firebase Auth & Cloud Firestore**) no estilo "Warm Analog Editorial". Permite registrar e catalogar shows passados, acompanhar turnês e festivais futuros confirmados (2026, 2027, 2028+), salvar faixas ouvidas ao vivo e desbloquear insígnias colecionáveis (*badges*).

---

## 🚀 Como Rodar o Projeto (Passo a Passo)

### 1. Pré-requisitos
- **Node.js**: v18+ ou v20+ (recomendado v20+)
- **NPM**: v9+
- Para compilar o APK Android nativo: **Java OpenJDK 21** e **Android SDK 35** instalados.

### 2. Instalação das Dependências
Clone o repositório e instale os pacotes:

```bash
git clone https://github.com/PedroH2M/StageLog.git
cd StageLog
npm install
```

### 3. Configuração de Variáveis de Ambiente (`.env`)
Copie o arquivo de exemplo para criar seu `.env`:

```bash
cp .env.example .env
```

Preencha com as credenciais do projeto Firebase (`stagelog-1087e`) e a API da Setlist.fm:

```env
# 1. API Oficial Setlist.fm (https://www.setlist.fm/settings/api)
VITE_SETLIST_FM_API_KEY=Dmzf9NcMBMxWmT0fG-ynMbVXjHYkUYAsivjV

# 2. Firebase Console (Projeto stagelog-1087e)
VITE_FIREBASE_API_KEY=AIzaSyCvLVUIDT1PImWdKwSQwZwvPaTxC4PxAC8
VITE_FIREBASE_AUTH_DOMAIN=stagelog-1087e.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=stagelog-1087e
VITE_FIREBASE_STORAGE_BUCKET=stagelog-1087e.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=537742445602
VITE_FIREBASE_APP_ID=1:537742445602:web:4d2ddba3096113455a4e7b
VITE_FIREBASE_MEASUREMENT_ID=G-FMBB29ZSFM
```

> **Nota:** As chaves também podem ser salvas ou trocadas diretamente na interface do app pelo modal de Configurações (`⚙️`).

### 4. Rodando em Modo de Desenvolvimento (Web)
Inicie o servidor de desenvolvimento com recarregamento em tempo real (HMR) e proxies de API:

```bash
npm run dev
```

Abra no navegador em: **[http://localhost:5173](http://localhost:5173)**.

---

## 📱 Compilação Android & Geração de APK

O projeto utiliza **Capacitor 7** para empacotar a aplicação web como app nativo Android completo.

### Comandos Rápidos

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor local de desenvolvimento Vite com proxy de APIs |
| `npm run build` | Compila o TypeScript (`tsc -b`) e cria a pasta de produção `dist/` |
| `npm run cap:sync` | Roda o build e sincroniza os arquivos web com a pasta `android/` |
| `npm run apk` | Executa o script automatizado que compila e assina o APK (`StageLog-v1.0.apk`) |
| `npm run aab` | Gera o pacote Android App Bundle para publicação na Google Play Store |
| `npm run cap:open` | Abre o projeto nativo diretamente no **Android Studio** |

### Keystore de Assinatura Release
O script automatizado de release assina o APK via Gradle com as configurações em `android/app/build.gradle`:
- **Alias:** `stagelog`
- **Senha da chave / store:** `stagelog2026`
- **Caminho da keystore local:** `android/keystore/stagelog-release.jks` (ignorado no git por segurança; crie ou insira sua keystore nessa pasta se for recompilar localmente).
- *Caso a keystore não exista na máquina*, o Gradle automaticamente faz o build de debug padrão sem falhar.

---

## 🏛️ Arquitetura do Código

```
StageLog/
├── android/                   # Projeto nativo Android (Capacitor)
│   ├── app/src/main/res/      # Ícones adaptativos e splash screen editorial
│   └── app/build.gradle       # Configuração de build e assinatura Android
├── firebase/
│   └── firestore.rules        # Regras de segurança do Cloud Firestore
├── scripts/
│   └── build-apk.ps1          # Script PowerShell para build automatizado do APK
├── src/
│   ├── components/            # Componentes React
│   │   ├── AuthScreen.tsx         # Tela de autenticação (Google + Email/Senha)
│   │   ├── ShowCard.tsx           # Cartão de show estilo Ticket Stub perfurado
│   │   ├── ShowDetailModal.tsx    # Modal de setlist, avaliação e confirmação
│   │   ├── BadgeUnlockModal.tsx   # Modal de comemoração de insígnia conquistada
│   │   ├── AddCustomShowModal.tsx # Registro manual de shows independentes
│   │   ├── SettingsModal.tsx      # Configurações de perfil e chaves
│   │   └── BadgeIcon.tsx          # Renderizador de ícones de insígnias
│   ├── data/
│   │   ├── badgesCatalog.ts          # Catálogo de 25+ insígnias e hinos
│   │   └── officialUpcomingCatalog.ts# Calendário verificado de turnês 2026/2027
│   ├── services/
│   │   ├── setlistApiService.ts   # Conexão unificada Bandsintown + Setlist.fm
│   │   ├── cloudSyncService.ts    # Firebase Auth e sincronização Cloud Firestore
│   │   ├── badgeEngine.ts         # Motor de regras e desbloqueio de badges
│   │   └── storageRepository.ts   # Persistência local offline e conversão automática
│   ├── styles/
│   │   └── app.css                # Design system Warm Analog Editorial
│   ├── types/
│   │   └── models.ts              # Tipos TypeScript do domínio
│   ├── utils/
│   │   └── dateUtils.ts           # Utilitários de fuso horário e datas ISO
│   ├── App.tsx                    # Componente raiz, navegação e abas
│   └── main.tsx                   # Ponto de entrada React
├── capacitor.config.ts        # Configurações do Capacitor Mobile
├── vite.config.ts             # Configuração do Vite, portas e proxies reversos
└── package.json               # Dependências e scripts
```

---

## 🎸 Principais Recursos Implementados

1. **Descoberta de Shows em Tempo Real:**
   - **Shows Passados:** Consulta a API oficial da Setlist.fm com histórico completo de apresentações e músicas tocadas em cada show.
   - **Shows Futuros (2026, 2027 e 2028):** Integração com a API da **Bandsintown** e radar curado de turnês internacionais e nacionais no Brasil.
   - **Festivais Oficiais:** Suporte completo com line-up detalhado por dia para edições do **Rock in Rio**, **Lollapalooza Brasil** (incluindo 19, 20 e 21 de março de 2027) e **The Town**.
2. **Registro & Passaporte Musical:**
   - Marcar presença em shows já vividos ou confirmar presença antecipada na agenda futura.
   - Seleção das faixas ouvidas ao vivo, música favorita da noite, nota (1 a 5 estrelas) e memórias pessoais.
   - Conversão automática: shows confirmados na agenda futura tornam-se presença automaticamente assim que a data do show chega.
3. **Coleção de Insígnias (*Badges*):**
   - Sistema de gamificação por níveis (*Bronze, Prata, Ouro, Diamante*).
   - Desbloqueio automático baseado em bandas vistas ao vivo, volume de shows, festivais frequentados e hinos clássicos escutados.
4. **Sincronização Cloud:**
   - Dados persistidos offline no `localStorage` e sincronizados em tempo real no **Cloud Firestore** sob a conta autenticada do usuário.

---

## 🤝 Fluxo de Trabalho & Contribuição

1. Crie uma branch para novas funcionalidades:
   ```bash
   git checkout -b feature/minha-melhoria
   ```
2. Realize as alterações e verifique a integridade do TypeScript:
   ```bash
   npm run build
   ```
3. Faça o commit e abra o Pull Request:
   ```bash
   git commit -m "feat: descrição da melhoria"
   git push origin feature/minha-melhoria
   ```

export type NarrationPacing = 'pausado' | 'normal' | 'rapido' | 'expressivo';

export type TTSEngine = 'kokoro-82m' | 'gemini-flash' | 'cloud-neural2' | 'browser-native';

export interface TTSEngineOption {
  id: TTSEngine;
  label: string;
  badge: string;
  description: string;
}

export const TTS_ENGINE_OPTIONS: TTSEngineOption[] = [
  {
    id: 'kokoro-82m',
    label: 'Kokoro-82M (Hugging Face)',
    badge: 'Open-Weight 82M',
    description: 'Modelo de fala ultra-humano e natural da comunidade Hugging Face (hexgrad/Kokoro-82M).',
  },
  {
    id: 'gemini-flash',
    label: 'Gemini 3.1 Flash TTS (Padrão)',
    badge: 'Padrão IA',
    description: 'Áudio fluído, expressivo e de alta fidelidade com inteligência multimodal.',
  },
  {
    id: 'cloud-neural2',
    label: 'Google Cloud Neural2',
    badge: '4M Grátis/mês',
    description: 'Vozes neurais padrão de alta capacidade mensal.',
  },
  {
    id: 'browser-native',
    label: 'Voz Nativa do Navegador (PT-BR)',
    badge: 'Offline Local',
    description: 'Sintetizador local no computador, sem uso de internet ou cotas de API.',
  },
];

export const KOKORO_VOICES: VoiceOption[] = [
  {
    id: 'pf_dora',
    name: 'Dora (Kokoro PT-BR)',
    gender: 'Feminino',
    title: 'Voz Didática & Clara',
    description: 'Voz feminina oficial em Português do Brasil do modelo Kokoro-82M (hexgrad).',
    idealFor: 'Onboarding, Treinamentos Internos, Cursos E-learning',
  },
  {
    id: 'pm_alex',
    name: 'Alex (Kokoro PT-BR)',
    gender: 'Masculino',
    title: 'Voz Corporativa & Direta',
    description: 'Voz masculina oficial em Português do Brasil com tom firme e objetivo.',
    idealFor: 'Vendas, Liderança, Apresentações Executivas',
  },
  {
    id: 'pm_santa',
    name: 'Santa (Kokoro PT-BR)',
    gender: 'Masculino',
    title: 'Voz Grave & Instrutiva',
    description: 'Voz masculina profunda em Português do Brasil para instruções técnicas.',
    idealFor: 'Segurança do Trabalho, Compliance, Tutoriais de TI',
  },
];

export interface PacingOption {
  id: NarrationPacing;
  label: string;
  speedTag: string;
  wpmEstimate: string;
  description: string;
  badge: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'Feminino' | 'Masculino';
  title: string;
  description: string;
  idealFor: string;
}

export interface NarrationStyle {
  id: 'didatico' | 'motivacional' | 'tecnico' | 'institucional' | 'calmo';
  label: string;
  description: string;
  badge: string;
}

export interface PresetTemplate {
  id: string;
  category: string;
  title: string;
  description: string;
  suggestedVoice: string;
  suggestedStyle: 'didatico' | 'motivacional' | 'tecnico' | 'institucional' | 'calmo';
  script: string;
  isMultiSpeaker?: boolean;
}

export interface ModuleSlide {
  id: string;
  slideNumber: number;
  title: string;
  script: string;
  imageUrl?: string;
  themeBg?: 'dark-tech' | 'deep-blue' | 'corporate-slate' | 'emerald-gradient' | 'warm-amber';
  audioUrl?: string;
  duration?: number;
  voice?: string;
  style?: string;
  pacing?: NarrationPacing;
  status: 'idle' | 'generating' | 'ready' | 'error';
  errorMessage?: string;
}

export interface AudioHistoryItem {
  id: string;
  title: string;
  text: string;
  audioUrl: string;
  duration: number;
  voice: string;
  style: string;
  pacing?: NarrationPacing;
  createdAt: string;
  isMultiSpeaker?: boolean;
}

export const GEMINI_VOICES: VoiceOption[] = [
  {
    id: 'Kore',
    name: 'Kore (Neural2 PT-BR)',
    gender: 'Feminino',
    title: 'Voz Didática & Executiva',
    description: 'Tom firme, articulado e claro. Voz neural Google de altíssima fidelidade.',
    idealFor: 'Onboarding, Manuais, Treinamentos Internos',
  },
  {
    id: 'Puck',
    name: 'Puck (WaveNet PT-BR)',
    gender: 'Masculino',
    title: 'Voz Entusiasta & Engajadora',
    description: 'Tom dinâmico, enérgico e amigável, que mantém a atenção dos alunos.',
    idealFor: 'Treinamento de Vendas, Pitchs, Lançamentos',
  },
  {
    id: 'Charon',
    name: 'Charon (WaveNet PT-BR)',
    gender: 'Masculino',
    title: 'Voz Grave & Autoridade',
    description: 'Tom corporativo profundo, sério e seguro.',
    idealFor: 'Segurança do Trabalho (EPI/NRs), Compliance, Código de Ética',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir (Neural2 PT-BR)',
    gender: 'Masculino',
    title: 'Voz Técnica & Direta',
    description: 'Dicção ágil, objetiva e muito clara para processos operacionais.',
    idealFor: 'Sistemas, Softwares, Screencasts, Tutoriais de TI',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr (Neural2 PT-BR)',
    gender: 'Feminino',
    title: 'Voz Acolhedora & Suave',
    description: 'Tom caloroso, empático, ideal para conteúdo humanizado.',
    idealFor: 'Soft Skills, Liderança, Comunicação Não-Violenta',
  },
];

export const NARRATION_STYLES: NarrationStyle[] = [
  {
    id: 'didatico',
    label: 'Didático e Educativo',
    description: 'Pausas estratégicas para melhor assimilação do conteúdo.',
    badge: 'Recomendado para E-learning',
  },
  {
    id: 'institucional',
    label: 'Institucional / Onboarding',
    description: 'Tom acolhedor, profissional e alinhado à cultura da empresa.',
    badge: 'Boas-vindas',
  },
  {
    id: 'tecnico',
    label: 'Técnico e Segurança',
    description: 'Dicção firme e ritmo constante para normas, processos e EPIs.',
    badge: 'Normas & Compliance',
  },
  {
    id: 'motivacional',
    label: 'Entusiasta e Vendas',
    description: 'Ritmo vibrante e enérgico para equipes comerciais.',
    badge: 'Comercial',
  },
  {
    id: 'calmo',
    label: 'Calmo e Humanizado',
    description: 'Tom pausado para diálogos de feedback e desenvolvimento interpessoal.',
    badge: 'Soft Skills',
  },
];

export const NARRATION_PACING_OPTIONS: PacingOption[] = [
  {
    id: 'pausado',
    label: 'Pausado e Cadenciado',
    speedTag: 'Lento (0.8x)',
    wpmEstimate: '~110 ppm',
    description: 'Dicção tranquila com respiro e pausas claras de assimilação entre cada frase. Ideal para processos complexos.',
    badge: 'Alta Assimilação',
  },
  {
    id: 'normal',
    label: 'Equilibrado e Natural',
    speedTag: 'Normal (1.0x)',
    wpmEstimate: '~140 ppm',
    description: 'Cadência fluida e padrão de e-learning corporativo em Português do Brasil.',
    badge: 'Padrão E-learning',
  },
  {
    id: 'rapido',
    label: 'Dinâmico e Acelerado',
    speedTag: 'Rápido (1.25x)',
    wpmEstimate: '~175 ppm',
    description: 'Fala ágil, objetiva e direta, sem pausas prolongadas. Excelente para recaps e avisos rápidos.',
    badge: 'Conteúdo Dinâmico',
  },
  {
    id: 'expressivo',
    label: 'Ritmo Variável & Expressivo',
    speedTag: 'Variável',
    wpmEstimate: '~130-160 ppm',
    description: 'Cadência humana que acelera para dar energia e desacelera pontualmente para dar ênfase.',
    badge: 'Engajamento Humano',
  },
];

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'onboarding-boas-vindas',
    category: 'Onboarding & Cultura',
    title: 'Boas-Vindas aos Novos Colaboradores',
    description: 'Boas-vindas institucionais para o primeiro dia de trabalho na empresa.',
    suggestedVoice: 'Kore',
    suggestedStyle: 'institucional',
    script: `Olá! Seja muito bem-vindo à nossa equipe. Estamos entusiasmados em ter você conosco nesta jornada de crescimento.

Neste módulo de integração, você aprenderá sobre nossa missão, nossos valores fundamentais e os primeiros passos para o seu dia a dia na empresa.

Por favor, certifique-se de preencher seus dados no portal do colaborador e atentar-se às diretrizes da nossa cultura. Bom treinamento!`,
  },
  {
    id: 'seguranca-nr10-epi',
    category: 'Segurança do Trabalho (SST)',
    title: 'Treinamento Obrigatorio de EPIs e CIPA',
    description: 'Locução direta e com tom de autoridade para procedimentos de segurança.',
    suggestedVoice: 'Charon',
    suggestedStyle: 'tecnico',
    script: `Atenção, colaborador. A segurança no ambiente de trabalho é a nossa prioridade absoluta.

Antes de iniciar qualquer atividade na área operacional, verifique o estado do seu Capacete, Óculos de Proteção e Protetor Auricular.

[pausa de 1s]

Lembre-se: em caso de inconformidade ou risco iminente, exerça o seu Direito de Recusa e comunique imediatamente a equipe da CIPA ou o técnico de segurança responsável. Siga sempre as orientações das NRs.`,
  },
  {
    id: 'dialogo-atendimento-cliente',
    category: 'Simulações e Diálogos',
    title: 'Diálogo: Atendimento com Empatia',
    description: 'Roteiro narrado a duas vozes (Instrutor e Aluno) para simulação interativa.',
    suggestedVoice: 'Kore',
    suggestedStyle: 'didatico',
    isMultiSpeaker: true,
    script: `Instrutor: Vamos analisar uma situação real de atendimento. Quando um cliente entra em contato frustrado, qual deve ser a sua primeira atitude?
Aluno: O primeiro passo é praticar a escuta ativa, mantendo a calma e demonstrando empatia genuína pela dúvida do cliente.
Instrutor: Exatamente! Nunca interrompa o cliente enquanto ele relata o problema. Valide o sentimento e proponha a solução de forma transparente.`,
  },
  {
    id: 'tutorial-sistema-crm',
    category: 'Sistemas & TI',
    title: 'Passo a Passo: Cadastro no Sistema Interno',
    description: 'Roteiro dinâmico para acompanhamento de tela ou screencast.',
    suggestedVoice: 'Fenrir',
    suggestedStyle: 'tecnico',
    script: `Para cadastrar uma nova oportunidade no CRM, siga os seguintes passos:

Primeiro, acesse o painel principal e clique no botão azul "Novo Cliente", localizado no canto superior direito.

[pausa de 1s]

Em seguida, preencha o CNPJ ou CPF da empresa e selecione a categoria de serviço. Ao concluir, clique em "Salvar e Notificar Gerente". O sistema gerará um número de protocolo instantaneamente.`,
  },
  {
    id: 'vendas-pitch-meta',
    category: 'Vendas & Comercial',
    title: 'Kickoff Comercial e Abordagem de Vendas',
    description: 'Narrativa entusiasmada para engajar times de vendas e pós-vendas.',
    suggestedVoice: 'Puck',
    suggestedStyle: 'motivacional',
    script: `Equipe comercial, atenção! Nesta nova campanha, nosso foco principal é gerar valor real para os nossos clientes desde o primeiro contato.

Lembre-se: não estamos apenas vendendo um produto, estamos entregando a solução para uma dor diária da empresa dele.

Aborde com confiança, faça perguntas inteligentes e mostre o retorno sobre o investimento. Vamos juntos alcançar a nossa meta do trimestre!`,
  },
];

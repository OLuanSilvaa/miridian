import { addDays } from './formatters.js';

export const REQUEST_CONTENT_VERSION = 2;
export const REQUEST_TYPES = ['Compra de materiais', 'Manutenção de equipamentos', 'Aquisição de serviços', 'Transferência de recursos', 'Solicitação administrativa', 'Reposição de estoque', 'Solicitação de infraestrutura'];
export const LEGACY_REQUEST_TITLES = ['Reposição de materiais de operação', 'Manutenção preventiva da linha de produção', 'Contratação de suporte especializado', 'Transferência de equipamentos de apoio', 'Adequação do espaço administrativo', 'Reposição de insumos do almoxarifado', 'Modernização da infraestrutura de rede'];
const TITLES = [
  ['Substituição de equipamentos de refrigeração', 'Aquisição de servidores para infraestrutura', 'Renovação das estações de trabalho', 'Compra de equipamentos de proteção individual', 'Aquisição de nobreaks para a operação', 'Substituição de mobiliário do atendimento', 'Compra de coletores para conferência de cargas', 'Aquisição de impressoras para expedição'],
  ['Manutenção corretiva {unidade}', 'Revisão do sistema de climatização', 'Reparo do compressor da área de produção', 'Calibração dos sensores de temperatura', 'Manutenção preventiva das empilhadeiras', 'Substituição de rolamentos da esteira', 'Revisão dos painéis de distribuição elétrica', 'Reparo da impressora do almoxarifado'],
  ['Contratação de transporte especializado', 'Serviço de calibração de instrumentos', 'Contratação de suporte técnico de rede', 'Limpeza técnica da área de produção', 'Inspeção das instalações prediais', 'Contratação de coleta de resíduos industriais', 'Serviço de recuperação de componentes', 'Contratação de treinamento operacional'],
  ['Transferência de equipamentos de apoio', 'Remanejamento de mobiliário entre unidades', 'Redistribuição de notebooks corporativos', 'Transferência de coletores de dados', 'Realocação de kits de manutenção', 'Transferência de peças para a oficina central', 'Remanejamento de impressoras do atendimento', 'Redistribuição de equipamentos de proteção'],
  ['Ampliação do espaço administrativo', 'Adequação da sala de reuniões', 'Reorganização do arquivo de contratos', 'Renovação da sinalização interna', 'Atualização do plano de continuidade operacional', 'Revisão dos procedimentos de recebimento', 'Readequação do espaço de atendimento', 'Atualização do inventário de documentos'],
  ['Reposição de insumos do almoxarifado', 'Reposição de filtros para climatização', 'Abastecimento de materiais de embalagem', 'Reposição de componentes elétricos', 'Recomposição do estoque de ferramentas', 'Reposição de peças para manutenção', 'Abastecimento de materiais de limpeza técnica', 'Reposição de etiquetas para rastreabilidade'],
  ['Modernização da infraestrutura de rede', 'Ampliação dos pontos de acesso sem fio', 'Adequação da iluminação do galpão', 'Instalação de sensores de monitoramento', 'Revisão da infraestrutura de energia', 'Adequação da rede de combate a incêndio', 'Ampliação da área de armazenamento', 'Atualização do cabeamento do atendimento'],
];

export function seedRequestDetails(index, unitName) {
  const unitIndex = index % 14;
  const sequence = Math.floor(index / 14);
  const categoryIndex = (sequence + unitIndex * 3) % REQUEST_TYPES.length;
  const variant = (Math.floor(sequence / REQUEST_TYPES.length) + unitIndex) % TITLES[categoryIndex].length;
  const name = String(unitName || `Unidade ${String(unitIndex + 1).padStart(2, '0')}`).slice(0, 80);
  const location = `${name.startsWith('Centro') ? 'do' : 'da'} ${name}`;
  return { category: REQUEST_TYPES[categoryIndex], title: TITLES[categoryIndex][variant].replace('{unidade}', () => location) };
}

export function migrateRequestContent(data) {
  if ((data.requestContentVersion || 0) >= REQUEST_CONTENT_VERSION) return data;
  const units = new Map(data.units.map(row => [row.id, row]));
  const changed = new Map();
  const requests = data.requests.map(row => {
    const match = /^SOL-(\d{4})-(\d{4})$/.exec(row.id);
    if (!match || match[1] !== data.seedDate.slice(0, 4)) return row;
    const index = Number(match[2]) - 1;
    if (index < 0 || index >= 2400 || Object.hasOwn(row, 'description')) return row;
    if (row.title !== LEGACY_REQUEST_TITLES[index % 7] || row.category !== REQUEST_TYPES[index % 7]) return row;
    if (row.unitId !== `U${String(index % 14 + 1).padStart(2, '0')}` || row.created !== addDays(data.seedDate, -Math.floor((2399 - index) * 330 / 2400))) return row;
    const detail = seedRequestDetails(index, units.get(row.unitId)?.name);
    changed.set(row.id, { previousTitle: row.title, title: detail.title });
    return { ...row, ...detail };
  });
  const transactions = data.transactions.map(row => {
    const change = changed.get(row.requestId);
    return change && row.description === change.previousTitle ? { ...row, description: change.title } : row;
  });
  return { ...data, requests, transactions, requestContentVersion: REQUEST_CONTENT_VERSION };
}

import { create } from 'zustand'
import { api } from '../api'

interface Recursos {
    madeira: number
    argila: number
    ferro: number
}

export type NomeTela = 'aldeia' | 'mapa' | 'relatorios' | 'tribo' | 'admin'

interface EstadoUsuario {
    id: string
    nomeUsuario: string
    role?: 'PLAYER' | 'ADMIN'
}

export interface Notificacao {
    id: string
    mensagem: string
    tipo: 'sucesso' | 'erro' | 'info'
}

interface EstadoJogo {
    recursos: Recursos
    definirRecursos: (recursos: Recursos) => void
    mensagemGlobal: string | null
    definirMensagemGlobal: (msg: string | null) => void
    telaAtual: NomeTela
    definirTela: (tela: NomeTela) => void
    token: string | null
    usuario: EstadoUsuario | null
    notificacoes: Notificacao[]
    adicionarNotificacao: (mensagem: string, tipo: 'sucesso' | 'erro' | 'info') => void
    removerNotificacao: (id: string) => void
    realizarLogin: (token: string, usuario: EstadoUsuario) => void
    realizarLogout: () => void
    isDefeated: boolean
    definirDerrota: (derrotado: boolean) => void
    dadosAldeia: any | null
    filaAtiva: any[]
    filaUnidadesAtiva: any[]
    activeMultipliers: { wood: number; clay: number; iron: number }
    serverSpeed: number
    sincronizarAldeiaSilenciosa: () => Promise<void>
    userVillages: any[]
    activeVillageId: string | null
    trocarAldeiaAtiva: (id: string) => void
}

export const usarEstadoJogo = create<EstadoJogo>((set, get) => ({
    recursos: { madeira: 0, argila: 0, ferro: 0 },
    definirRecursos: (recursos) => set({ recursos }),
    dadosAldeia: null,
    filaAtiva: [],
    filaUnidadesAtiva: [],
    activeMultipliers: { wood: 1.0, clay: 1.0, iron: 1.0 },
    serverSpeed: 1.0,
    userVillages: [],
    activeVillageId: null,
    trocarAldeiaAtiva: (id) => {
        set({ activeVillageId: id, dadosAldeia: null })
        get().sincronizarAldeiaSilenciosa()
    },
    sincronizarAldeiaSilenciosa: async () => {
        const estado = get()
        if (!estado.token) return
        try {
            let idAldeia = estado.activeVillageId || estado.dadosAldeia?.id

            if (!idAldeia || estado.userVillages.length === 0) {
                // Primeira sincronização ou cache vazio: busca aldeias e configurações globais
                const dadosMeResponse = await api.get('/me/villages', estado.token)
                const { villages, globalMessage, isDefeated, serverSpeed } = dadosMeResponse
                
                set({ 
                    mensagemGlobal: globalMessage || null, 
                    isDefeated: isDefeated || false,
                    serverSpeed: serverSpeed || 1.0,
                    userVillages: villages || []
                })
                
                if (villages && villages.length > 0) {
                    if (!idAldeia) {
                        idAldeia = villages[0].id
                        set({ activeVillageId: idAldeia })
                    }
                }
            }

            if (idAldeia) {
                const dados = await api.get(`/village/${idAldeia}`, estado.token)
                
                set({
                    dadosAldeia: dados,
                    activeVillageId: idAldeia,
                    activeMultipliers: dados.activeMultipliers || { wood: 1.0, clay: 1.0, iron: 1.0 },
                    recursos: {
                        madeira: dados.resources.wood || 0,
                        argila: dados.resources.clay || 0,
                        ferro: dados.resources.iron || 0
                    },
                    filaAtiva: dados.activeQueue || [],
                    filaUnidadesAtiva: dados.activeUnitQueue || []
                })
            }
        } catch (erro: any) {
            // Em caso de erro (ex: aldeia deletada ou token expirado), limpa o cache para forçar a redestribuição
            set({ dadosAldeia: null, activeVillageId: null, userVillages: [] })
        }
    },
    mensagemGlobal: null,
    definirMensagemGlobal: (msg) => set({ mensagemGlobal: msg }),
    telaAtual: (() => {
        try {
            const token = localStorage.getItem('tw2_token')
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]))
                if (payload.role === 'ADMIN') return 'admin'
            }
        } catch {}
        return 'aldeia'
    })() as NomeTela,
    definirTela: (tela) => set({ telaAtual: tela }),
    token: localStorage.getItem('tw2_token'),
    usuario: (() => {
        try {
            const token = localStorage.getItem('tw2_token')
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]))
                return { id: payload.id, nomeUsuario: payload.username, role: payload.role }
            }
            return null
        } catch { return null }
    })(),
    notificacoes: [],
    adicionarNotificacao: (mensagem, tipo) => {
        const id = Math.random().toString(36).substring(2, 9)
        set((estado) => ({
            notificacoes: [...estado.notificacoes, { id, mensagem, tipo }]
        }))
        
        // Auto-remover após 4 segundos
        setTimeout(() => {
            set((estado) => ({
                notificacoes: estado.notificacoes.filter(n => n.id !== id)
            }))
        }, 4000)
    },
    removerNotificacao: (id) => set((estado) => ({
        notificacoes: estado.notificacoes.filter(n => n.id !== id)
    })),
    realizarLogin: (token, usuario) => {
        localStorage.setItem('tw2_token', token)
        set({ token, usuario, telaAtual: usuario.role === 'ADMIN' ? 'admin' : 'aldeia' })
    },
    realizarLogout: () => {
        localStorage.removeItem('tw2_token')
        set({ token: null, usuario: null, dadosAldeia: null, filaAtiva: [], filaUnidadesAtiva: [], userVillages: [], activeVillageId: null })
    },
    isDefeated: false,
    definirDerrota: (derrotado) => set({ isDefeated: derrotado })
}))
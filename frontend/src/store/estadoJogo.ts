import { create } from 'zustand'

interface Recursos {
    madeira: number
    argila: number
    ferro: number
}

export type NomeTela = 'aldeia' | 'mapa' | 'relatorios' | 'tribo'

interface EstadoUsuario {
    id: string
    nomeUsuario: string
}

export interface Notificacao {
    id: string
    mensagem: string
    tipo: 'sucesso' | 'erro' | 'info'
}

interface EstadoJogo {
    recursos: Recursos
    definirRecursos: (recursos: Recursos) => void
    telaAtual: NomeTela
    definirTela: (tela: NomeTela) => void
    token: string | null
    usuario: EstadoUsuario | null
    notificacoes: Notificacao[]
    adicionarNotificacao: (mensagem: string, tipo: 'sucesso' | 'erro' | 'info') => void
    removerNotificacao: (id: string) => void
    realizarLogin: (token: string, usuario: EstadoUsuario) => void
    realizarLogout: () => void
}

export const usarEstadoJogo = create<EstadoJogo>((set) => ({
    recursos: { madeira: 0, argila: 0, ferro: 0 },
    definirRecursos: (recursos) => set({ recursos }),
    telaAtual: 'aldeia',
    definirTela: (tela) => set({ telaAtual: tela }),
    token: localStorage.getItem('tw2_token'),
    usuario: (() => {
        try {
            const token = localStorage.getItem('tw2_token')
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]))
                return { id: payload.id, nomeUsuario: payload.username }
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
        set({ token, usuario, telaAtual: 'aldeia' })
    },
    realizarLogout: () => {
        localStorage.removeItem('tw2_token')
        set({ token: null, usuario: null })
    }
}))
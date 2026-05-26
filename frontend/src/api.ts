const BASE_URL = (import.meta.env.PROD && import.meta.env.VITE_API_URL) 
    ? import.meta.env.VITE_API_URL 
    : `http://${window.location.hostname}:8080`

/**
 * Função interna para tratar a resposta da Fetch API e jogar erros consistentes
 */
async function handleResponse(response: Response) {
    let data
    try {
        data = await response.json()
    } catch {
        data = null
    }

    if (!response.ok) {
        // Status 401 (Não Autorizado) - Geralmente login incorreto ou token inválido
        if (response.status === 401) {
            throw new Error('E-mail ou senha incorretos.')
        }

        // Status 500 (Erro no Servidor) - Erros catastróficos que devemos mascarar do usuário
        if (response.status >= 500) {
            throw new Error('Ocorreu um erro no servidor. Tente novamente mais tarde.')
        }

        // Outros erros da família 400 (Bad Request, Forbidden, etc) - Podemos usar a mensagem do servidor se existir
        throw new Error(data?.error || 'Ocorreu um erro inesperado.')
    }

    return data
}

/**
 * Interceptador para erros de rede (ex: servidor desligado, sem internet, CORS block catastrofico)
 */
function handleNetworkError(error: any) {
    if (error.name === 'TypeError' || error.message === 'Failed to fetch') {
        throw new Error('Servidor offline ou rede inacessível.')
    }
    throw error
}

export const api = {
    get: async (endpoint: string, token?: string) => {
        const headers: HeadersInit = {}
        if (token) headers['Authorization'] = `Bearer ${token}`

        return fetch(`${BASE_URL}${endpoint}`, { headers })
            .then(handleResponse)
            .catch(handleNetworkError)
    },

    post: async (endpoint: string, body: any, token?: string) => {
        const headers: HeadersInit = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        return fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        })
            .then(handleResponse)
            .catch(handleNetworkError)
    },

    put: async (endpoint: string, body: any, token?: string) => {
        const headers: HeadersInit = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        return fetch(`${BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body)
        })
            .then(handleResponse)
            .catch(handleNetworkError)
    },

    del: async (endpoint: string, token?: string) => {
        const headers: HeadersInit = {}
        if (token) headers['Authorization'] = `Bearer ${token}`

        return fetch(`${BASE_URL}${endpoint}`, {
            method: 'DELETE',
            headers
        })
            .then(handleResponse)
            .catch(handleNetworkError)
    }
}

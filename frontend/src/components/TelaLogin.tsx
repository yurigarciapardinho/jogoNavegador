import React, { useState } from 'react'
import { usarEstadoJogo } from '../store/estadoJogo'
import { api } from '../api'

const TelaLogin: React.FC = () => {
    const { realizarLogin, adicionarNotificacao } = usarEstadoJogo()
    
    // Variáveis de estado em português
    const [modoLogin, definirModoLogin] = useState(true)
    const [emailInformado, definirEmail] = useState('')
    const [nomeInformado, definirNome] = useState('')
    const [senhaInformada, definirSenha] = useState('')
    const [carregando, definirCarregando] = useState(false)
    
    const [erroEmail, definirErroEmail] = useState('')
    const [erroNome, definirErroNome] = useState('')
    const [erroSenha, definirErroSenha] = useState('')

    // Função de validação padrão YGP (atualizada para spans ao invés de alerts)
    const validacoes = () => {
        let ehValido = true
        
        definirErroEmail('')
        definirErroNome('')
        definirErroSenha('')

        if (!modoLogin && (!emailInformado.includes('@') || !emailInformado.includes('.'))) {
            definirErroEmail('Informe um e-mail válido.')
            ehValido = false
        }

        if (nomeInformado.length < 3) {
            definirErroNome('O usuário deve ter pelo menos 3 caracteres.')
            ehValido = false
        }

        if (senhaInformada.length < 6) {
            definirErroSenha('A senha deve ter pelo menos 6 caracteres.')
            ehValido = false
        }

        return ehValido
    }

    const processarFormulario = async (evento: React.FormEvent) => {
        evento.preventDefault()

        if (!validacoes()) return

        definirCarregando(true)

        const urlAPI = modoLogin ? '/auth/login' : '/auth/register'
        const corpoRequisicao = modoLogin 
            ? { username: nomeInformado, password: senhaInformada } 
            : { email: emailInformado, username: nomeInformado, password: senhaInformada }

        try {
            const dados = await api.post(urlAPI, corpoRequisicao)

            if (modoLogin) {
                // Parse JWT to get user
                const payload = JSON.parse(atob(dados.token.split('.')[1]))
                realizarLogin(dados.token, { id: payload.id, nomeUsuario: payload.username, role: payload.role })
                adicionarNotificacao('Login realizado com sucesso!', 'sucesso')
            } else {
                adicionarNotificacao('Conta criada com sucesso! Faça login.', 'sucesso')
                definirModoLogin(true)
                definirSenha('')
            }
        } catch (erro: any) {
            adicionarNotificacao(erro.message || 'Erro de conexão com o servidor.', 'erro')
        } finally {
            definirCarregando(false)
        }
    }

    const alternarTelas = () => {
        definirModoLogin(!modoLogin)
        definirErroEmail('')
        definirErroNome('')
        definirErroSenha('')
    }

    return (
        <section className="telaLogin animarSurgimento">
            <div className="telaLogin_caixa">
                <h1 className="telaLogin_titulo">
                    {modoLogin ? 'Acessar Aldeia' : 'Criar Conta'}
                </h1>

                <form onSubmit={processarFormulario} className="telaLogin_formulario">
                    {!modoLogin && (
                        <div className="campoGrupo">
                            <label className="campoRotulo">E-mail</label>
                            <input 
                                id="inputEmail"
                                type="email" 
                                value={emailInformado}
                                onChange={(e) => definirEmail(e.target.value)}
                                className={`campoEntrada ${erroEmail ? 'campoEntrada--erro' : ''}`}
                            />
                            {erroEmail && <span className="mensagemErroValidacao">{erroEmail}</span>}
                        </div>
                    )}

                    <div className="campoGrupo">
                        <label className="campoRotulo">Usuário</label>
                        <input 
                            id="inputNome"
                            type="text" 
                            value={nomeInformado}
                            onChange={(e) => definirNome(e.target.value)}
                            className={`campoEntrada ${erroNome ? 'campoEntrada--erro' : ''}`}
                        />
                        {erroNome && <span className="mensagemErroValidacao">{erroNome}</span>}
                    </div>

                    <div className="campoGrupo">
                        <label className="campoRotulo">Senha</label>
                        <input 
                            id="inputSenha"
                            type="password" 
                            value={senhaInformada}
                            onChange={(e) => definirSenha(e.target.value)}
                            className={`campoEntrada ${erroSenha ? 'campoEntrada--erro' : ''}`}
                        />
                        {erroSenha && <span className="mensagemErroValidacao">{erroSenha}</span>}
                    </div>

                    <button 
                        type="submit" 
                        disabled={carregando}
                        className="botaoGeral botaoGeral--primario botaoGeral--largo"
                        style={{ marginTop: 'var(--espacamentoPequeno)' }}
                    >
                        {carregando ? 'Carregando...' : (modoLogin ? 'Entrar' : 'Registrar')}
                    </button>
                </form>

                <div className="telaLogin_rodape">
                    <button 
                        onClick={alternarTelas}
                        className="botaoGeral botaoGeral--secundario"
                    >
                        {modoLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça Login'}
                    </button>
                </div>
            </div>
        </section>
    )
}

export default TelaLogin

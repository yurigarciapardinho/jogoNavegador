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
    const [confirmarSenhaInformada, definirConfirmarSenha] = useState('')
    const [regiao, definirRegiao] = useState('ALEATORIO')
    const [carregando, definirCarregando] = useState(false)
    const [senhaVisivel, definirSenhaVisivel] = useState(false)
    
    const [erroEmail, definirErroEmail] = useState('')
    const [erroNome, definirErroNome] = useState('')
    const [erroSenha, definirErroSenha] = useState('')
    const [erroConfirmarSenha, definirErroConfirmarSenha] = useState('')

    // Função de validação padrão YGP (atualizada para spans ao invés de alerts)
    const validacoes = () => {
        let ehValido = true
        
        definirErroEmail('')
        definirErroNome('')
        definirErroSenha('')
        definirErroConfirmarSenha('')

        const emailLimpo = emailInformado.trim()
        const nomeLimpo = nomeInformado.trim()

        if (!modoLogin && (!emailLimpo.includes('@') || !emailLimpo.includes('.'))) {
            definirErroEmail('Informe um e-mail válido.')
            ehValido = false
        }

        if (nomeLimpo.length < 3) {
            definirErroNome('O usuário deve ter pelo menos 3 caracteres.')
            ehValido = false
        }

        if (senhaInformada.length < 6) {
            definirErroSenha('A senha deve ter pelo menos 6 caracteres.')
            ehValido = false
        }

        if (!modoLogin && senhaInformada !== confirmarSenhaInformada) {
            definirErroConfirmarSenha('As senhas não coincidem.')
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
            ? { username: nomeInformado.trim(), password: senhaInformada } 
            : { email: emailInformado.trim(), username: nomeInformado.trim(), password: senhaInformada, confirmPassword: confirmarSenhaInformada, region: regiao }

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
                definirConfirmarSenha('')
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
        definirErroConfirmarSenha('')
        definirSenhaVisivel(false)
    }

    return (
        <section className="telaLogin animarSurgimento">
            <div className="telaLogin_caixa">
                <h1 className="telaLogin_titulo">
                    {modoLogin ? 'Acessar Aldeia' : 'Criar Conta'}
                </h1>

                <form onSubmit={processarFormulario} className="telaLogin_formulario">
                    {!modoLogin && (
                        <>
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
                            
                            <div className="campoGrupo">
                                <label className="campoRotulo">Região de Nascimento</label>
                                <select 
                                    value={regiao} 
                                    onChange={(e) => definirRegiao(e.target.value)} 
                                    className="campoEntrada"
                                >
                                    <option value="ALEATORIO">Aleatório (Padrão)</option>
                                    <option value="NO">Noroeste (NO)</option>
                                    <option value="N">Norte (N)</option>
                                    <option value="NE">Nordeste (NE)</option>
                                    <option value="O">Oeste (O)</option>
                                    <option value="L">Leste (L)</option>
                                    <option value="SO">Sudoeste (SO)</option>
                                    <option value="S">Sul (S)</option>
                                    <option value="SE">Sudeste (SE)</option>
                                </select>
                            </div>
                        </>
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
                        <div className="campoEntrada--senha-wrapper">
                            <input 
                                id="inputSenha"
                                type={senhaVisivel ? 'text' : 'password'}
                                value={senhaInformada}
                                onChange={(e) => definirSenha(e.target.value)}
                                className={`campoEntrada ${erroSenha ? 'campoEntrada--erro' : ''}`}
                            />
                            <button 
                                type="button"
                                className="botaoOlhinho"
                                onClick={() => definirSenhaVisivel(!senhaVisivel)}
                                aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
                                aria-pressed={senhaVisivel}
                            >
                                <span aria-hidden="true">{senhaVisivel ? '👁️‍🗨️' : '👁️'}</span>
                            </button>
                        </div>
                        {erroSenha && <span className="mensagemErroValidacao">{erroSenha}</span>}
                    </div>

                    {!modoLogin && (
                        <div className="campoGrupo">
                            <label className="campoRotulo">Confirmar Senha</label>
                            <div className="campoEntrada--senha-wrapper">
                                <input 
                                    id="inputConfirmarSenha"
                                    type={senhaVisivel ? 'text' : 'password'}
                                    value={confirmarSenhaInformada}
                                    onChange={(e) => definirConfirmarSenha(e.target.value)}
                                    className={`campoEntrada ${erroConfirmarSenha ? 'campoEntrada--erro' : ''}`}
                                />
                                <button 
                                    type="button"
                                    className="botaoOlhinho"
                                    onClick={() => definirSenhaVisivel(!senhaVisivel)}
                                    aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
                                    aria-pressed={senhaVisivel}
                                >
                                    <span aria-hidden="true">{senhaVisivel ? '👁️‍🗨️' : '👁️'}</span>
                                </button>
                            </div>
                            {erroConfirmarSenha && <span className="mensagemErroValidacao">{erroConfirmarSenha}</span>}
                        </div>
                    )}

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

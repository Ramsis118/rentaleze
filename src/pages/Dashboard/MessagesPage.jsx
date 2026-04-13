import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api'

export default function MessagesPage() {
    const { user } = useAuth()
    const [conversations, setConversations] = useState([])
    const [loadingConv, setLoadingConv] = useState(true)
    
    const [activeConvo, setActiveConvo] = useState(null)
    const [messages, setMessages] = useState([])
    const [loadingMsgs, setLoadingMsgs] = useState(false)
    const [inputText, setInputText] = useState('')
    
    const messagesEndRef = useRef(null)

    // Fetch conversations list
    useEffect(() => {
        const fetchConv = async () => {
            try {
                const data = await api.request('/messages')
                setConversations(data)
                if (data.length > 0 && !activeConvo) {
                    handleSelectConvo(data[0])
                }
            } catch (error) {
                console.error(error)
            } finally {
                setLoadingConv(false)
            }
        }
        fetchConv()
    }, [])

    const handleSelectConvo = async (convo) => {
        setActiveConvo(convo)
        setLoadingMsgs(true)
        try {
            const data = await api.request(`/messages/${convo.id}`)
            setMessages(data.messages)
        } catch (error) {
            console.error(error)
        } finally {
            setLoadingMsgs(false)
            scrollToBottom()
        }
    }

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
    }

    const handleSend = async (e) => {
        e.preventDefault()
        if (!inputText.trim() || !activeConvo) return

        const sentText = inputText
        setInputText('')

        // Optimistic update
        const tempMsg = {
            id: 'temp-' + Date.now(),
            sender_id: user.id,
            text: sentText,
            created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, tempMsg])
        scrollToBottom()

        try {
            await api.request('/messages', {
                method: 'POST',
                body: JSON.stringify({
                    listingId: activeConvo.listing_id || activeConvo.id, // Depends on actual query format, assuming we pass recipient
                    recipientId: activeConvo.other_user_id,
                    text: sentText
                })
            })
            // Refresh conversations list to update preview
            const data = await api.request('/messages')
            setConversations(data)
        } catch (error) {
            alert('Failed to send message')
        }
    }

    const formatTime = (isoString) => {
        return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }

    const formatDate = (isoString) => {
        return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    if (loadingConv) {
        return <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 rounded-full border-4 border-rl-gray-3 border-t-rl-blue" /></div>
    }

    return (
        <div className="flex flex-col md:flex-row h-[600px] bg-white rounded-2xl border border-rl-gray-3 overflow-hidden">
            
            {/* Conversations Sidebar */}
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-rl-gray-3 flex flex-col shrink-0">
                <div className="p-4 border-b border-rl-gray-3 bg-rl-gray-5">
                    <h2 className="font-extrabold text-rl-dark">Messages</h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {conversations.length === 0 ? (
                        <div className="p-6 text-center text-rl-gray text-sm">
                            No messages yet.
                        </div>
                    ) : (
                        conversations.map(c => (
                            <button
                                key={c.id}
                                onClick={() => handleSelectConvo(c)}
                                className={`w-full text-left p-4 flex gap-3 transition-colors border-b border-rl-gray-3 last:border-0 ${activeConvo?.id === c.id ? 'bg-rl-blue-50/50' : 'hover:bg-rl-gray-4'}`}
                            >
                                <img src={c.other_avatar || c.listing_image} className="w-12 h-12 rounded-full object-cover shrink-0 bg-rl-gray-4" alt="Avatar"/>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <h4 className="font-bold text-rl-dark text-sm truncate pr-2">{c.other_first_name}</h4>
                                        <span className="text-[10px] font-medium text-rl-gray shrink-0">{formatDate(c.updated_at)}</span>
                                    </div>
                                    <p className="text-xs font-semibold text-rl-blue truncate mb-0.5">{c.listing_title}</p>
                                    <p className="text-xs text-rl-gray truncate">{c.last_message}</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Chat View */}
            <div className="flex-1 flex flex-col min-w-0 bg-rl-off-white/30">
                {activeConvo ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-rl-gray-3 bg-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <img src={activeConvo.other_avatar || activeConvo.listing_image} className="w-10 h-10 rounded-full object-cover shrink-0" />
                                <div>
                                    <h3 className="font-bold text-rl-dark text-sm">{activeConvo.other_first_name}</h3>
                                    <p className="text-xs text-rl-gray line-clamp-1">{activeConvo.listing_title}</p>
                                </div>
                            </div>
                            <Link to={`/listing/${activeConvo.listing_id}`} className="text-xs font-semibold text-rl-blue hover:underline">
                                View Item
                            </Link>
                        </div>

                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {loadingMsgs ? (
                                <div className="flex justify-center p-4"><div className="animate-spin w-6 h-6 rounded-full border-2 border-rl-gray-3 border-t-rl-blue" /></div>
                            ) : messages.length === 0 ? (
                                <div className="text-center text-sm text-rl-gray py-8">No messages in this conversation.</div>
                            ) : (
                                messages.map(msg => {
                                    const isMe = msg.sender_id === user.id
                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMe ? 'bg-rl-blue text-white rounded-br-none' : 'bg-white border border-rl-gray-3 text-rl-dark rounded-bl-none shadow-sm'}`}>
                                                <p className="text-sm">{msg.text}</p>
                                                <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-rl-blue-200' : 'text-rl-gray-2'}`}>
                                                    {formatTime(msg.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <div className="p-4 bg-white border-t border-rl-gray-3">
                            <form onSubmit={handleSend} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 input-field !bg-rl-gray-4 border-transparent focus:bg-white"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputText.trim()}
                                    className="bg-rl-blue text-white w-12 h-11 rounded-xl flex items-center justify-center shrink-0 hover:bg-rl-blue-500 transition-colors disabled:opacity-50"
                                >
                                    <svg className="w-5 h-5 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-rl-gray p-8 text-center">
                        <svg className="w-16 h-16 mb-4 text-rl-gray-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        <p className="text-lg font-bold text-rl-dark-3 mb-1">Your messages</p>
                        <p className="text-sm">Select a conversation or start a new one to chat directly with other users.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

import { useEffect, useRef, useState } from 'react';
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { AxiosError } from 'axios';
import MicIcon from '@mui/icons-material/Mic';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { PageHeader } from '../components/PageHeader';
import { chat } from '../api/endpoints';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function cleanAssistantText(content: string) {
  return content
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '- ')
    .trim();
}

function AssistantMessageContent({ content }: { content: string }) {
  const cleaned = cleanAssistantText(content);
  const blocks = cleaned.split(/\n{2,}/).filter(Boolean);

  return (
    <Stack spacing={1}>
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        const isList = lines.every((line) => line.startsWith('- '));

        if (isList) {
          return (
            <Stack key={blockIndex} component="ul" spacing={0.5} sx={{ pl: 2.25, my: 0 }}>
              {lines.map((line, lineIndex) => (
                <Typography key={lineIndex} component="li" variant="body2" sx={{ lineHeight: 1.6 }}>
                  {line.replace(/^- /, '')}
                </Typography>
              ))}
            </Stack>
          );
        }

        return (
          <Stack key={blockIndex} spacing={0.5}>
            {lines.map((line, lineIndex) => {
              const isSection = /^[A-Z][A-Za-z ]+:$/.test(line) || /^[A-Z][A-Za-z ]+:\s/.test(line);
              return (
                <Typography key={lineIndex} variant="body2" sx={{ lineHeight: 1.65, fontWeight: isSection && lineIndex === 0 ? 750 : 400 }}>
                  {line}
                </Typography>
              );
            })}
          </Stack>
        );
      })}
    </Stack>
  );
}

export function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechMessage, setSpeechMessage] = useState('');
  const recognitionRef = useRef<any>(null);
  const dictationBaseRef = useRef('');
  const sendingRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setSpeechMessage('Voice input is not supported by this browser. Use Chrome or Edge on localhost/HTTPS.');
      return;
    }

    setSpeechSupported(true);
    setSpeechMessage('Tap the mic to start dictation.');
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setError('');
      setSpeechMessage('Listening... speak now.');
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      setInput([dictationBaseRef.current, transcript].filter(Boolean).join(' '));
    };

    recognition.onend = () => {
      setListening(false);
      setSpeechMessage('Tap the mic again to continue dictation.');
    };

    recognition.onnomatch = () => {
      setError('Voice input did not recognize any speech. Please try again.');
    };

    recognition.onerror = (event: any) => {
      setListening(false);
      setSpeechMessage('Voice input stopped.');
      setError(`Voice input error: ${event.error ?? 'Speech recognition failed.'}`);
    };

    recognitionRef.current = recognition;
  }, []);

  async function send() {
    if (!input.trim() || sendingRef.current) return;
    sendingRef.current = true;
    const prompt = input;
    setInput('');
    setError('');
    setMessages((current) => [...current, { role: 'user', content: prompt }]);
    setLoading(true);
    try {
      const response = await chat(prompt, conversationId);
      setConversationId(response.conversation?.id);
      setMessages((current) => [...current, { role: 'assistant', content: typeof response.result === 'string' ? response.result : JSON.stringify(response.result, null, 2) }]);
    } catch (caught) {
      const axiosError = caught as AxiosError<{ error?: { message?: string } }>;
      const message = axiosError.response?.data?.error?.message ?? axiosError.message ?? 'Assistant request failed.';
      setMessages((current) => [...current, { role: 'assistant', content: `I could not complete that request yet.\n\n${message}` }]);
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  }

  function toggleListening() {
    if (!recognitionRef.current) {
      setError('Voice input is not available in this browser.');
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      return;
    }

    setError('');
    dictationBaseRef.current = input.trim();
    try {
      recognitionRef.current.start();
    } catch (startError) {
      setListening(false);
      setError(`Voice input failed to start: ${String(startError)}`);
    }
  }

  return (
    <>
      <PageHeader title="AI Assistant" subtitle="Ask for calendar, email, task, and general productivity help." />
      <Card>
        <CardContent>
          <Stack spacing={2} sx={{ minHeight: { xs: 'calc(100vh - 150px)', md: 560 } }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.25}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Avatar sx={{ bgcolor: 'primary.main' }}><SmartToyIcon /></Avatar>
                <Box>
                  <Typography variant="h6">Workspace Copilot</Typography>
                  <Typography variant="body2" color="text.secondary">Mail, calendar, and tasks in one conversation.</Typography>
                </Box>
              </Stack>
              <Chip size="small" label={conversationId ? 'Conversation saved' : 'New chat'} color={conversationId ? 'success' : 'default'} variant="outlined" sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }} />
            </Stack>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, p: { xs: 1.25, sm: 2 }, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: '#f8faff', minHeight: { xs: 300, sm: 340 } }}>
              {messages.length === 0 && (
                <Box sx={{ my: 'auto', textAlign: 'center', mx: 'auto', maxWidth: 480 }}>
                  <Typography variant="h6">What should we move forward?</Typography>
                  <Typography color="text.secondary">Try asking for unread email priorities, a meeting plan, or a task breakdown.</Typography>
                </Box>
              )}
              {messages.map((message, index) => (
                <Box key={index} sx={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: { xs: '96%', md: '78%' }, bgcolor: message.role === 'user' ? 'primary.main' : '#ffffff', color: message.role === 'user' ? 'white' : 'text.primary', p: 1.5, borderRadius: 2, border: message.role === 'assistant' ? '1px solid' : 0, borderColor: 'divider', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', boxShadow: message.role === 'assistant' ? '0 10px 24px rgba(18, 26, 43, 0.06)' : 'none', animation: 'page-enter 220ms ease both' }}>
                  {message.role === 'assistant' ? <AssistantMessageContent content={message.content} /> : <Typography variant="body2">{message.content}</Typography>}
                </Box>
              ))}
              {loading && (
                <Box sx={{ alignSelf: 'flex-start', bgcolor: '#ffffff', border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1.25, boxShadow: '0 10px 24px rgba(18, 26, 43, 0.06)' }}>
                  <span className="thinking-dots" aria-label="Assistant is thinking">
                    <span />
                    <span />
                    <span />
                  </span>
                </Box>
              )}
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="stretch">
              <TextField
                fullWidth
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Summarize unread work emails or create a meeting tomorrow at 2 PM"
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }}
                helperText={speechMessage}
              />
              <Stack direction="row" spacing={1} justifyContent={{ xs: 'space-between', sm: 'flex-start' }}>
                <Tooltip title={speechSupported ? (listening ? 'Stop voice input' : 'Start voice input') : 'Voice input not supported'}>
                  <span>
                    <IconButton
                      color={listening ? 'primary' : 'default'}
                      onClick={toggleListening}
                      disabled={!speechSupported}
                      aria-label="Toggle voice input"
                    >
                      <MicIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Button disabled={loading} variant="contained" endIcon={<SendIcon />} onClick={send} sx={{ flex: { xs: 1, sm: 'initial' } }}>Send</Button>
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </>
  );
}

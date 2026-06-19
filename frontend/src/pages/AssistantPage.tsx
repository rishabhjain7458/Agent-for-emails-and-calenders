import { Fragment, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, Divider, Grid, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { AxiosError } from 'axios';
import MicIcon from '@mui/icons-material/Mic';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EventIcon from '@mui/icons-material/Event';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { PageHeader } from '../components/PageHeader';
import { chat, getAssistantConversation, getAssistantConversations } from '../api/endpoints';
import { useSpace } from '../contexts/SpaceContext';
import type { AssistantConversation } from '../types';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function cleanAssistantText(content: string) {
  return readableAssistantText(content)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '- ')
    .trim();
}

function readableAssistantText(content: string) {
  const trimmed = content.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return content;

  try {
    const parsed = JSON.parse(trimmed);
    const event = parsed?.event ?? parsed;
    if (event?.kind === 'calendar#event' || event?.htmlLink || event?.summary) {
      return [
        event.status === 'confirmed' ? 'Meeting created.' : 'Calendar result.',
        '',
        event.summary ? `Title: ${event.summary}` : '',
        event.start?.dateTime || event.start?.date ? `Starts: ${formatDisplayDate(event.start.dateTime ?? event.start.date)}` : '',
        event.end?.dateTime || event.end?.date ? `Ends: ${formatDisplayDate(event.end.dateTime ?? event.end.date)}` : '',
        event.description ? `Notes: ${event.description}` : '',
        event.htmlLink ? `Calendar link: ${event.htmlLink}` : ''
      ].filter(Boolean).join('\n');
    }

    if (Array.isArray(parsed)) {
      return parsed.map((item, index) => `${index + 1}. ${item.title ?? item.subject ?? item.summary ?? JSON.stringify(item)}`).join('\n');
    }
  } catch {
    return content;
  }

  return content;
}

function formatDisplayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function renderInlineText(text: string) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return parts.map((part, index) => {
    if (!/^https?:\/\//.test(part)) return <Fragment key={index}>{part}</Fragment>;
    return (
      <Box key={index} component="a" href={part} target="_blank" rel="noreferrer" sx={{ color: 'primary.main', fontWeight: 700, wordBreak: 'break-all' }}>
        Open link
      </Box>
    );
  });
}

function labelValue(lines: string[], label: string) {
  return lines.find((line) => line.toLowerCase().startsWith(`${label.toLowerCase()}:`))?.replace(/^[^:]+:\s*/, '');
}

function AssistantStructuredCard({ cleaned }: { cleaned: string }) {
  const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean);
  const first = lines[0] ?? '';
  const isMeeting = /meeting created|calendar result/i.test(first);
  const isEmail = /^found \d+ emails?/i.test(first) || lines.includes('Emails');
  const isTask = /tasks?|pending/i.test(first) && lines.some((line) => /task|pending|completed/i.test(line));

  if (!isMeeting && !isEmail && !isTask) return null;

  const icon = isMeeting ? <EventIcon /> : isEmail ? <MailOutlineIcon /> : <CheckCircleIcon />;
  const title = isMeeting ? 'Meeting created' : isEmail ? first : 'Tasks';
  const actionHref = isMeeting ? '/calendar' : isEmail ? '/emails' : '/tasks';
  const calendarLink = labelValue(lines, 'Calendar link');
  const rows = isMeeting
    ? [
      ['Title', labelValue(lines, 'Title')],
      ['Starts', labelValue(lines, 'Starts')],
      ['Ends', labelValue(lines, 'Ends')],
      ['Notes', labelValue(lines, 'Notes')]
    ].filter((row) => row[1])
    : lines
      .filter((line) => !/^email \d+$/i.test(line) && !/^(emails|available accounts)$/i.test(line) && line !== first)
      .slice(0, 8)
      .map((line) => {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        return match ? [match[1], match[2]] : ['', line];
      });

  return (
    <Card variant="outlined" sx={{ bgcolor: 'background.paper', boxShadow: 'none' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={1.25}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Avatar sx={{ width: 30, height: 30, bgcolor: isMeeting ? 'secondary.light' : 'primary.light', color: isMeeting ? 'secondary.dark' : 'primary.dark' }}>
              {icon}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>{title}</Typography>
              {isEmail && <Typography variant="caption" color="text.secondary">Showing compact results</Typography>}
            </Box>
          </Stack>
          <Stack spacing={0.8}>
            {rows.map(([label, value], index) => (
              <Box key={`${label}-${index}`} sx={{ borderTop: index ? '1px solid' : 0, borderColor: 'divider', pt: index ? 0.8 : 0 }}>
                {label && <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>{label}</Typography>}
                <Typography variant="body2" sx={{ lineHeight: 1.55, overflowWrap: 'anywhere' }}>{renderInlineText(String(value))}</Typography>
              </Box>
            ))}
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button size="small" variant="contained" href={actionHref} endIcon={<OpenInNewIcon />}>
              Open {isMeeting ? 'calendar' : isEmail ? 'emails' : 'tasks'}
            </Button>
            {isMeeting && calendarLink && (
              <Button size="small" variant="outlined" href={calendarLink} target="_blank">
                Google event
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function AssistantMessageContent({ content }: { content: string }) {
  const cleaned = cleanAssistantText(content);
  const rendered = AssistantStructuredCard({ cleaned });
  if (rendered) return rendered;
  const blocks = cleaned.split(/\n{2,}/).filter(Boolean);

  return (
    <Stack spacing={1}>
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        const isBulletList = lines.every((line) => line.startsWith('- '));
        const isNumberedList = lines.every((line) => /^\d+\.\s+/.test(line));

        if (isBulletList || isNumberedList) {
          return (
            <Stack key={blockIndex} component={isNumberedList ? 'ol' : 'ul'} spacing={0.75} sx={{ pl: 2.5, my: 0 }}>
              {lines.map((line, lineIndex) => (
                <Typography key={lineIndex} component="li" variant="body2" sx={{ lineHeight: 1.65, pl: 0.25 }}>
                  {renderInlineText(line.replace(/^(-|\d+\.)\s+/, ''))}
                </Typography>
              ))}
            </Stack>
          );
        }

        return (
          <Stack key={blockIndex} spacing={0.65}>
            {lines.map((line, lineIndex) => {
              const isSection = /^[A-Z][A-Za-z0-9 ]+:$/.test(line);
              const labelMatch = line.match(/^([A-Z][A-Za-z0-9 ]+):\s+(.+)$/);
              return (
                <Box key={lineIndex}>
                  {isSection ? (
                    <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 850, mt: lineIndex === 0 ? 0 : 0.5 }}>
                      {line.replace(/:$/, '')}
                    </Typography>
                  ) : labelMatch ? (
                    <Typography variant="body2" sx={{ lineHeight: 1.65 }}>
                      <Box component="span" sx={{ fontWeight: 800, color: 'text.primary' }}>{labelMatch[1]}: </Box>
                      {renderInlineText(labelMatch[2])}
                    </Typography>
                  ) : (
                    <Typography variant="body2" sx={{ lineHeight: 1.65 }}>
                      {renderInlineText(line)}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Stack>
        );
      })}
    </Stack>
  );
}

export function AssistantPage() {
  const [searchParams] = useSearchParams();
  const { activeSpaceId, activeSpace, isCombined } = useSpace();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechMessage, setSpeechMessage] = useState('');
  const recognitionRef = useRef<any>(null);
  const dictationBaseRef = useRef('');
  const sendingRef = useRef(false);

  async function loadConversations() {
    setHistoryLoading(true);
    try {
      setConversations(await getAssistantConversations());
    } finally {
      setHistoryLoading(false);
    }
  }

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

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    const prompt = searchParams.get('prompt');
    if (prompt) setInput(prompt);
  }, [searchParams]);

  async function openConversation(id: string) {
    setError('');
    const conversation = await getAssistantConversation(id);
    setConversationId(conversation.id);
    setMessages(conversation.messages.map((message) => ({ role: message.role, content: message.content })));
  }

  function startNewChat() {
    setConversationId(undefined);
    setMessages([]);
    setInput('');
    setError('');
  }

  async function send() {
    if (!input.trim() || sendingRef.current) return;
    sendingRef.current = true;
    const prompt = input;
    setInput('');
    setError('');
    setMessages((current) => [...current, { role: 'user', content: prompt }]);
    setLoading(true);
    try {
      const response = await chat(prompt, conversationId, activeSpaceId);
      setConversationId(response.conversation?.id);
      setMessages((current) => [...current, { role: 'assistant', content: typeof response.result === 'string' ? response.result : JSON.stringify(response.result, null, 2) }]);
      loadConversations();
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
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={3.5} lg={3}>
          <Card className="premium-panel" sx={{ height: '100%' }}>
            <CardContent>
              <Stack spacing={2}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={startNewChat}>New Chat</Button>
                <Box>
                  <Typography variant="h6">History</Typography>
                  <Typography variant="body2" color="text.secondary">{historyLoading ? 'Loading chats...' : `${conversations.length} saved conversations`}</Typography>
                </Box>
                <Stack className="scroll-thin" divider={<Divider flexItem />} spacing={0} sx={{ maxHeight: { md: 560 }, overflowY: 'auto', pr: 0.5 }}>
                  {conversations.map((conversation) => (
                    <Box
                      key={conversation.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openConversation(conversation.id)}
                      onKeyDown={(event) => { if (event.key === 'Enter') openConversation(conversation.id); }}
                      sx={{
                        cursor: 'pointer',
                        py: 1.25,
                        px: 1,
                        borderRadius: 2,
                        bgcolor: conversationId === conversation.id ? 'action.selected' : 'transparent',
                        transition: 'background 160ms ease, transform 160ms ease',
                        '&:hover': { bgcolor: 'action.hover', transform: { sm: 'translateX(3px)' } }
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 750 }} noWrap>{conversation.title || 'New conversation'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(conversation.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </Typography>
                    </Box>
                  ))}
                  {!historyLoading && conversations.length === 0 && (
                    <Alert severity="info">Your saved chats will appear here.</Alert>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8.5} lg={9}>
          <Card className="premium-panel">
            <CardContent>
          <Stack spacing={2} sx={{ minHeight: { xs: 'calc(100vh - 150px)', md: 560 } }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.25}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Avatar sx={{ bgcolor: 'primary.main', boxShadow: '0 12px 26px rgba(37, 87, 214, 0.24)' }}><SmartToyIcon /></Avatar>
                <Box>
                  <Typography variant="h6">Workspace Copilot</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isCombined ? 'Using every connected space.' : `Using ${activeSpace?.email ?? 'selected space'}.`}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                <Chip size="small" icon={<AutoAwesomeIcon />} label={conversationId ? 'Conversation saved' : 'New chat'} color={conversationId ? 'success' : 'default'} variant="outlined" />
                <Chip size="small" label={isCombined ? 'Combined workspace' : activeSpace?.email ?? 'Selected space'} color={isCombined ? 'default' : 'primary'} variant={isCombined ? 'outlined' : 'filled'} />
              </Stack>
            </Stack>
            <Box className="scroll-thin" sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, p: { xs: 1.25, sm: 2 }, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover', minHeight: { xs: 300, sm: 340 }, maxHeight: { xs: 'none', md: 620 }, overflowY: 'auto' }}>
              {messages.length === 0 && (
                <Box sx={{ my: 'auto', textAlign: 'center', mx: 'auto', maxWidth: 480 }}>
                  <Avatar sx={{ bgcolor: 'secondary.light', color: 'secondary.dark', mx: 'auto', mb: 1.5 }}><AutoAwesomeIcon /></Avatar>
                  <Typography variant="h6">What should we move forward?</Typography>
                  <Typography color="text.secondary">Try asking for unread email priorities, a meeting plan, or a task breakdown.</Typography>
                </Box>
              )}
              {messages.map((message, index) => (
                <Box key={index} sx={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: { xs: '96%', md: '78%' }, bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper', color: message.role === 'user' ? 'primary.contrastText' : 'text.primary', p: 1.5, borderRadius: 2, border: message.role === 'assistant' ? '1px solid' : 0, borderColor: 'divider', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', boxShadow: message.role === 'assistant' ? '0 10px 24px rgba(0, 0, 0, 0.12)' : 'none', animation: 'page-enter 220ms ease both' }}>
                  {message.role === 'assistant' ? <AssistantMessageContent content={message.content} /> : <Typography variant="body2">{message.content}</Typography>}
                </Box>
              ))}
              {loading && (
                <Box sx={{ alignSelf: 'flex-start', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1.25, boxShadow: '0 10px 24px rgba(0, 0, 0, 0.12)' }}>
                  <span className="thinking-dots" aria-label="Assistant is thinking">
                    <span />
                    <span />
                    <span />
                  </span>
                </Box>
              )}
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="stretch" sx={{ position: 'sticky', bottom: 0, bgcolor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderTop: '1px solid', borderColor: 'divider', mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, pt: 1.25, pb: { xs: 1, sm: 0 } }}>
              <TextField
                fullWidth
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={isCombined ? 'Ask across all spaces or create a primary-calendar meeting' : `Ask inside ${activeSpace?.email ?? 'this space'}`}
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
        </Grid>
      </Grid>
    </>
  );
}

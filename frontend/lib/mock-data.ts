export type ChatStatus = 'nuevo' | 'en_proceso' | 'resuelto'
export type MessageRole = 'inbound' | 'outbound'

export interface Message {
  id: string
  role: MessageRole
  text: string
  time: string
}

export interface Citizen {
  id: string
  name: string
  phone: string
  colonia: string
  interests: string[]
  registeredAt: string
  department?: string
}

export interface Chat {
  id: string
  citizen: Citizen
  status: ChatStatus
  lastMessage: string
  lastTime: string
  unread: number
  messages: Message[]
}

export const MOCK_CHATS: Chat[] = [
  {
    id: 'c1',
    citizen: {
      id: 'u1',
      name: 'María González Ruiz',
      phone: '9661234567',
      colonia: 'La Candelaria, Cintalapa',
      interests: ['Agua Potable', 'Seguridad Pública'],
      registeredAt: '2025-03-12',
      department: 'Agua y Saneamiento',
    },
    status: 'nuevo',
    lastMessage: 'Llevamos 3 días sin agua en toda La Candelaria.',
    lastTime: '10:42 a.m.',
    unread: 3,
    messages: [
      { id: 'm1', role: 'inbound', text: 'Buenos días, quiero reportar un problema urgente en mi barrio.', time: '10:38 a.m.' },
      { id: 'm2', role: 'outbound', text: '¡Hola María! Con gusto te atendemos. ¿Cuál es el problema?', time: '10:39 a.m.' },
      { id: 'm3', role: 'inbound', text: 'Llevamos 3 días sin agua en toda La Candelaria.', time: '10:42 a.m.' },
    ],
  },
  {
    id: 'c2',
    citizen: {
      id: 'u2',
      name: 'Carlos Herrera Pérez',
      phone: '9669876543',
      colonia: 'Santo Domingo, Cintalapa',
      interests: ['Campo y Agricultura', 'Empleo Local'],
      registeredAt: '2025-02-20',
      department: 'Desarrollo Rural',
    },
    status: 'en_proceso',
    lastMessage: 'Gracias por la atención, esperamos la resolución pronto.',
    lastTime: 'Ayer',
    unread: 0,
    messages: [
      { id: 'm1', role: 'inbound', text: 'Los productores de maíz de Santo Domingo no recibieron el apoyo prometido este ciclo.', time: '09:15 a.m.' },
      { id: 'm2', role: 'outbound', text: 'Recibimos tu reporte, Carlos. Lo estamos escalando a Desarrollo Rural.', time: '09:20 a.m.' },
      { id: 'm3', role: 'inbound', text: 'Gracias por la atención, esperamos la resolución pronto.', time: '09:45 a.m.' },
    ],
  },
  {
    id: 'c3',
    citizen: {
      id: 'u3',
      name: 'Sofía Ramírez Torres',
      phone: '9661122334',
      colonia: 'El Mirador, Cintalapa',
      interests: ['Salud', 'Educación'],
      registeredAt: '2025-01-15',
      department: 'Salud',
    },
    status: 'resuelto',
    lastMessage: 'Excelente atención, muchas gracias por escucharnos.',
    lastTime: 'Lun',
    unread: 0,
    messages: [
      { id: 'm1', role: 'inbound', text: 'Necesito información sobre el centro de salud más cercano en El Mirador.', time: '02:00 p.m.' },
      { id: 'm2', role: 'outbound', text: 'Hola Sofía, el centro de salud más cercano está en Av. Central #12, Cintalapa Centro.', time: '02:05 p.m.' },
      { id: 'm3', role: 'inbound', text: 'Excelente atención, muchas gracias por escucharnos.', time: '02:10 p.m.' },
    ],
  },
  {
    id: 'c4',
    citizen: {
      id: 'u4',
      name: 'Roberto Mendoza Castillo',
      phone: '9664433221',
      colonia: 'Colonia Morelos, Cintalapa',
      interests: ['Seguridad Pública', 'Agua Potable'],
      registeredAt: '2025-03-20',
    },
    status: 'nuevo',
    lastMessage: 'Hay alumbrado público fundido en toda la cuadra desde hace semanas.',
    lastTime: '11:05 a.m.',
    unread: 1,
    messages: [
      { id: 'm1', role: 'inbound', text: 'Hay alumbrado público fundido en toda la cuadra desde hace semanas.', time: '11:05 a.m.' },
    ],
  },
  {
    id: 'c5',
    citizen: {
      id: 'u5',
      name: 'Ana Castillo Domínguez',
      phone: '9667788990',
      colonia: 'Centro, Cintalapa',
      interests: ['Campo y Agricultura', 'Empleo Local'],
      registeredAt: '2025-02-05',
      department: 'Obras Públicas',
    },
    status: 'en_proceso',
    lastMessage: 'Adjunto las fotos del camino dañado, espero pronta respuesta.',
    lastTime: 'Mar',
    unread: 2,
    messages: [
      { id: 'm1', role: 'inbound', text: 'El camino rural que lleva al ejido está muy dañado y los productores no pueden pasar.', time: 'Mar 09:00 a.m.' },
      { id: 'm2', role: 'outbound', text: 'Hola Ana, ¿podrías enviarnos una foto de la ubicación exacta del daño?', time: 'Mar 09:10 a.m.' },
      { id: 'm3', role: 'inbound', text: 'Adjunto las fotos del camino dañado, espero pronta respuesta.', time: 'Mar 09:30 a.m.' },
    ],
  },
  {
    id: 'c6',
    citizen: {
      id: 'u6',
      name: 'Lupita Flores Mendoza',
      phone: '9665566778',
      colonia: 'La Joya, Cintalapa',
      interests: ['Agua Potable', 'Salud'],
      registeredAt: '2025-03-25',
    },
    status: 'nuevo',
    lastMessage: 'El agua que llega huele raro y los niños se han enfermado.',
    lastTime: '8:30 a.m.',
    unread: 2,
    messages: [
      { id: 'm1', role: 'inbound', text: 'Buenos días. Soy de La Joya y tengo un reporte urgente.', time: '8:25 a.m.' },
      { id: 'm2', role: 'inbound', text: 'El agua que llega huele raro y los niños se han enfermado.', time: '8:30 a.m.' },
    ],
  },
]

export const DEPARTMENTS = [
  'Agua y Saneamiento',
  'Seguridad Pública',
  'Obras Públicas',
  'Salud',
  'Educación',
  'Desarrollo Rural',
  'Empleo y Economía',
  'Jurídico',
]

export const STATUS_CONFIG: Record<ChatStatus, { label: string; color: string; bg: string; dot: string }> = {
  nuevo: { label: 'Nuevo', color: 'text-amber-600', bg: 'bg-amber-100', dot: 'bg-amber-500' },
  en_proceso: { label: 'En proceso', color: 'text-primary', bg: 'bg-primary/10', dot: 'bg-primary' },
  resuelto: { label: 'Resuelto', color: 'text-accent', bg: 'bg-accent/10', dot: 'bg-accent' },
}

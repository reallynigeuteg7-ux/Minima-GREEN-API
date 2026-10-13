const now = () => Math.floor(Date.now() / 1000);

export const demoContacts = [
  { id: '79991112233@c.us', name: 'Александр Петров', phone: '79991112233' },
  { id: '79994445566@c.us', name: 'Мария Соколова', phone: '79994445566' },
  { id: '120363000000000000@g.us', name: 'Команда продукта', phone: '' },
];

export function demoMessages() {
  const n = now();
  return {
    '79991112233@c.us': [
      { id: 'd1', chatId: '79991112233@c.us', text: 'Привет! Как продвигается проект?', direction: 'incoming', timestamp: n - 3800 },
      { id: 'd2', chatId: '79991112233@c.us', text: 'Привет! Интерфейс уже готов, сейчас подключаю API 🚀', direction: 'outgoing', timestamp: n - 3450, status: 'read' },
      { id: 'd3', chatId: '79991112233@c.us', text: 'Звучит отлично! Покажешь, когда закончишь?', direction: 'incoming', timestamp: n - 2700 },
    ],
    '79994445566@c.us': [
      { id: 'd4', chatId: '79994445566@c.us', text: 'Спасибо за помощь с дизайном!', direction: 'incoming', timestamp: n - 86400 },
      { id: 'd5', chatId: '79994445566@c.us', text: 'Всегда пожалуйста ✨', direction: 'outgoing', timestamp: n - 86100, status: 'read' },
    ],
    '120363000000000000@g.us': [
      { id: 'd6', chatId: '120363000000000000@g.us', text: 'У нас всё готово к демонстрации.', direction: 'incoming', timestamp: n - 172800 },
    ],
  };
}

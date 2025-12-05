// dance-directions.js - Полная база всех танцевальных направлений
export const ALL_DANCE_DIRECTIONS = {
  // Направления, которые ЕСТЬ в CosmoDance
  available: {
    'hip-hop': {
      name: 'Hip-Hop (Хип-Хоп)',
      description: 'Уличный танец, зародившийся в афроамериканских и латиноамериканских кварталах Нью-Йорка в 1970-х годах. Включает в себя различные стили: popping (резкие сокращения мышц), locking (замирания в позах), breaking (акробатические элементы), house (ритмичные шаги). Развивает ритмичность, свободу движений и уверенность в себе.',
      for_beginners: 'Да, есть специальные группы для начинающих с нуля. Тренер научит базовым движениям и ритму.',
      duration: '60-85 минут',
      popularity: 'Очень высокая',
      tags: ['уличные танцы', 'современные', 'для всех возрастов', 'энергичные', 'ритмичные', 'молодежные'],
      benefits: [
        'Развивает чувство ритма',
        'Улучшает координацию',
        'Снимает стресс',
        'Повышает уверенность в себе',
        'Укрепляет мышцы всего тела'
      ]
    },
    'jazz-funk': {
      name: 'Jazz Funk (Джаз Фанк)',
      description: 'Смесь классического джаза, хип-хопа и фанка. Эмоциональный, женственный стиль с акцентом на изоляции (движение отдельных частей тела), волнах и резких остановках. Часто используется в клипах поп-звезд.',
      for_beginners: 'Да, есть начальные группы. Подходит для тех, кто хочет развить пластику и женственность.',
      duration: '60-85 минут',
      popularity: 'Высокая',
      tags: ['женственные', 'эмоциональные', 'пластика', 'изоляция', 'сценические', 'клиповые'],
      benefits: [
        'Развивает пластичность',
        'Улучшает осанку',
        'Работает с изоляцией',
        'Помогает выражать эмоции',
        'Укрепляет мышцы кора'
      ]
    },
    'contemporary': {
      name: 'Contemporary (Контемпорари)',
      description: 'Современный сценический танец, сочетающий элементы классического балета, джаза и модерна. Основан на естественных движениях тела, работе с весом, падениях и подъемах. Акцент на выражении эмоций и взаимодействии с пространством.',
      for_beginners: 'Да, можно начать с базовых техник. Подходит для тех, кто хочет выражать эмоции через движение.',
      duration: '85 минут',
      popularity: 'Средняя',
      tags: ['современные', 'сценические', 'эмоциональные', 'пластичные', 'экспрессивные', 'искусство'],
      benefits: [
        'Развивает гибкость',
        'Учит контролю тела',
        'Помогает выражать эмоции',
        'Улучшает осанку',
        'Развивает артистизм'
      ]
    },
    'high-heels': {
      name: 'High Heels (Высокие каблуки)',
      description: 'Женственный и сексуальный стиль танца на каблуках. Включает элементы стрип-пластики, джаз-фанка и латины. Развивает грацию, уверенность, женственность и умение двигаться в обуви на каблуках.',
      for_beginners: 'Да, можно начать без подготовки. Начинаем с низких каблуков и постепенно повышаем.',
      duration: '60 минут',
      popularity: 'Высокая',
      tags: ['женские', 'на каблуках', 'сексуальные', 'грация', 'уверенность', 'женственность'],
      benefits: [
        'Укрепляет мышцы ног',
        'Улучшает осанку',
        'Развивает грацию',
        'Повышает уверенность',
        'Учит двигаться в каблуках'
      ]
    },
    'latina': {
      name: 'Latina (Латина)',
      description: 'Зажигательные латиноамериканские танцы: сальса (кубинский парный танец), бачата (романтический доминиканский танец), меренге (быстрый доминиканский танец), реггетон (современный уличный стиль). Развивают пластику, чувство ритма и умение танцевать в паре.',
      for_beginners: 'Да, есть группы для начинающих. Можно приходить как в паре, так и одному.',
      duration: '60-85 минут',
      popularity: 'Высокая',
      tags: ['латиноамериканские', 'парные', 'зажигательные', 'ритмичные', 'страстные', 'социальные'],
      benefits: [
        'Развивает чувство ритма',
        'Улучшает координацию',
        'Учит танцевать в паре',
        'Снимает стресс',
        'Повышает настроение'
      ]
    },
    'twerk': {
      name: 'Twerk (Тверк)',
      description: 'Танец, основанный на изолированных движениях бедрами и ягодицами. Зародился в африканских и карибских танцевальных традициях. Развивает пластику нижней части тела, чувство ритма и координацию.',
      for_beginners: 'Да, есть начальный уровень. Не требует специальной подготовки.',
      duration: '60 минут',
      popularity: 'Средняя',
      tags: ['энергичные', 'бедра', 'ритмичные', 'современные', 'женские', 'изоляция'],
      benefits: [
        'Укрепляет мышцы ягодиц и бедер',
        'Развивает изоляцию',
        'Улучшает координацию',
        'Укрепляет пресс',
        'Сжигает калории'
      ]
    },
    'strip-dance': {
      name: 'Strip Dance (Стрип пластика)',
      description: 'Чувственный танец, развивающий пластику, грацию и уверенность в себе. Включает элементы стриптиза без раздевания: работа с шестом (у опоры), волны, вращения, плавные движения. Акцент на женственности и раскрепощении.',
      for_beginners: 'Да, можно начать с основ. Занятия проходят в комфортной атмосфере.',
      duration: '60 минут',
      popularity: 'Средняя',
      tags: ['чувственные', 'пластика', 'грация', 'женские', 'раскрепощение', 'уверенность'],
      benefits: [
        'Раскрепощает',
        'Развивает пластичность',
        'Улучшает осанку',
        'Повышает уверенность',
        'Учит контролю тела'
      ]
    },
    'break-dance': {
      name: 'Break Dance (Брейк-данс)',
      description: 'Уличный танец, включающий power moves (силовые вращательные элементы), footwork (быстрая работа ног на полу), freezes (замирания в сложных позах) и toprock (танцевальные шаги стоя). Развивает силу, выносливость и акробатические навыки.',
      for_beginners: 'Да, есть группы для новичков. Начинаем с базовых элементов без акробатики.',
      duration: '85 минут',
      popularity: 'Средняя',
      tags: ['уличные', 'акробатические', 'силовые', 'для всех', 'мужские', 'спортивные'],
      benefits: [
        'Развивает силу и выносливость',
        'Улучшает гибкость',
        'Развивает координацию',
        'Укрепляет все группы мышц',
        'Повышает уверенность'
      ]
    }
  },
  
  // Направления, которых пока НЕТ в CosmoDance
  not_available: {
    // Бальные танцы
    'waltz': {
      name: 'Вальс',
      description: 'Классический бальный танец с плавными вращательными движениями в такт музыке 3/4. Включает венский (быстрый) и медленный вальс.',
      status: 'Пока не преподается в CosmoDance',
      reason: 'Специализация студии на современных и уличных направлениях',
      alternatives: ['Contemporary (схожая плавность)', 'Latina (парные танцы)']
    },
    'tango': {
      name: 'Танго',
      description: 'Страстный парный танец аргентинского происхождения с четким ритмом, близким контактом и резкими движениями головы.',
      status: 'Не доступен в расписании',
      reason: 'Фокус студии на современных стилях, а не на классических бальных',
      alternatives: ['Latina (страстные парные танцы)', 'Contemporary (эмоциональная экспрессия)']
    },
    'foxtrot': {
      name: 'Фокстрот',
      description: 'Плавный бальный танец с длинными скользящими движениями, характерными для свинговой эры 1920-х годов.',
      status: 'Нет в программе студии',
      reason: 'Не входит в специализацию CosmoDance',
      alternatives: ['Jazz Funk (схожие плавные движения)', 'Contemporary']
    },
    'quickstep': {
      name: 'Квикстеп',
      description: 'Быстрый бальный танец с прыжками, киками и быстрыми передвижениями по залу.',
      status: 'Не преподается',
      reason: 'Специализация на уличных и современных стилях',
      alternatives: ['Hip-Hop (быстрые ритмичные движения)', 'Break Dance (динамика)']
    },
    
    // Народные танцы
    'russian-folk': {
      name: 'Русский народный танец',
      description: 'Традиционные русские танцы: хороводы (круговые танцы), кадриль (парный танец с фигурами), барыня (игривый женский танец).',
      status: 'Пока не преподается',
      reason: 'CosmoDance специализируется на современных направлениях',
      alternatives: ['Все доступные современные стили']
    },
    'flamenco': {
      name: 'Фламенко',
      description: 'Испанский танец с эмоциональной экспрессией, сложной работой ног (сапатеадо), кастаньетами и драматическими позами.',
      status: 'Не доступен',
      reason: 'Требует специальных преподавателей и оборудования',
      alternatives: ['Contemporary (эмоциональная выразительность)', 'High Heels (работа в характерной обуви)']
    },
    'irish-dance': {
      name: 'Ирландский танец',
      description: 'Быстрый танец с прямой спиной, быстрой работой ног и минимальными движениями руками.',
      status: 'Пока нет',
      reason: 'Не входит в текущую программу развития',
      alternatives: ['Break Dance (быстрая работа ног)', 'Hip-Hop (ритмичность)']
    },
    
    // Современные и уличные
    'krump': {
      name: 'Крамп',
      description: 'Агрессивный уличный танец с резкими движениями, грубой силой и эмоциональной экспрессией.',
      status: 'Пока не преподается',
      reason: 'Недостаточно запросов для формирования группы',
      alternatives: ['Hip-Hop (уличное направление)', 'Break Dance (силовые элементы)']
    },
    'vogue': {
      name: 'Вог',
      description: 'Стиль, основанный на позах моделей из журналов, с акцентом на линии, позы и драматические жесты.',
      status: 'Не доступен',
      reason: 'Планируется в будущем как отдельное направление',
      alternatives: ['Jazz Funk (схожая работа с позами)', 'High Heels (женственность)']
    },
    'dancehall': {
      name: 'Дэнсхолл',
      description: 'Ямайский уличный танец с сексуальными и ритмичными движениями под музыку регги и дэнсхолл.',
      status: 'Пока нет в программе',
      reason: 'Будет добавлен позже как развитие направления Latina',
      alternatives: ['Latina (карибские корни)', 'Twerk (схожая сексуальность)']
    },
    'k-pop': {
      name: 'K-Pop',
      description: 'Танцы в стиле корейской поп-музыки с синхронными движениями, четкими линиями и сложной хореографией.',
      status: 'Планируется',
      reason: 'Набирает популярность, группа формируется',
      alternatives: ['Jazz Funk (схожая клиповая хореография)', 'Hip-Hop (синхронность)']
    },
    
    // Классические
    'ballet': {
      name: 'Балет',
      description: 'Классический танец с строгой техникой, пуантами, выворотностью и грациозными движениями.',
      status: 'Нет в студии',
      reason: 'Требует отдельной студии, специального покрытия и многолетней подготовки',
      alternatives: ['Contemporary (развился из классического танца)', 'Jazz Funk (элементы джаза)']
    },
    'modern': {
      name: 'Модерн',
      description: 'Современный сценический танец, отрицающий каноны классического балета, с акцентом на естественных движениях.',
      status: 'Пока не доступен',
      reason: 'Частично присутствует в Contemporary, как отдельное направление не выделено',
      alternatives: ['Contemporary (прямой наследник модерна)']
    },
    
    // Социальные танцы
    'swing': {
      name: 'Свинг',
      description: 'Парный танец под джазовую музыку с импровизацией, вращениями и характерным "раскачиванием".',
      status: 'Не преподается',
      reason: 'Специализация CosmoDance на современных стилях',
      alternatives: ['Latina (парные социальные танцы)']
    },
    'lindy-hop': {
      name: 'Линди-хоп',
      description: 'Афроамериканский танец, возникший в Гарлеме в 1920-х годах, предшественник свинга.',
      status: 'Пока нет',
      reason: 'Не входит в программу',
      alternatives: ['Hip-Hop (уличные корни)', 'Latina (социальный аспект)']
    },
    
    // Фитнес-танцы
    'zumba': {
      name: 'Зумба',
      description: 'Фитнес-программа на основе латиноамериканских танцев, сочетающая кардио-нагрузку и танцевальные движения.',
      status: 'Не доступна',
      reason: 'CosmoDance фокусируется на танцевальной технике, а не на фитнес-программах',
      alternatives: ['Latina (латиноамериканская основа)', 'Twerk (активная кардио-нагрузка)']
    },
    'belly-dance': {
      name: 'Танец живота',
      description: 'Восточный танец с изолированными движениями бедер и живота, кругами грудной клеткой и волнами.',
      status: 'Пока не преподается',
      reason: 'Планируется в будущем как женское направление',
      alternatives: ['Twerk (изоляция нижней части тела)', 'Strip Dance (женственность)']
    },
    
    // Другие
    'pole-dance': {
      name: 'Танец на пилоне',
      description: 'Акробатический танец на вертикальном шесте, сочетающий силовые элементы, вращения и пластику.',
      status: 'Нет в студии',
      reason: 'Требует специального оборудования (пилонов) и страховки',
      alternatives: ['Strip Dance (схожая пластика)', 'Break Dance (акробатика)']
    },
    'aerial': {
      name: 'Воздушная гимнастика',
      description: 'Танцы на воздушных полотнах, кольцах, трапециях и других воздушных снарядах.',
      status: 'Не доступна',
      reason: 'Нет необходимого оборудования и страховочных систем',
      alternatives: ['Contemporary (работа с пространством)', 'Strip Dance (пластика)']
    },
    'tap-dance': {
      name: 'Чечётка',
      description: 'Танец, в котором ритм отбивается специальной обувью с металлическими набойками.',
      status: 'Пока не преподается',
      reason: 'Требует специальной обуви и подготовки пола',
      alternatives: ['Break Dance (ритмичная работа ног)', 'Hip-Hop (ритмичность)']
    }
  },
  
  // Все возможные варианты названий для поиска
  searchVariations: {
    // Hip-Hop
    'hip-hop': [
      'хип-хоп', 'хипхоп', 'хип хоп', 'hiphop', 'hip hop', 'хоп', 'хип',
      'hip', 'hop', 'уличные танцы', 'стрит дэнс', 'street dance',
      'паппинг', 'поппинг', 'popping', 'локинг', 'locking', 'брейкинг',
      'брейкинг', 'breaking', 'хаус', 'house', 'уличный танец'
    ],
    
    // Jazz Funk
    'jazz-funk': [
      'джаз фанк', 'джазфанк', 'jazzfunk', 'jazz funk', 'джаз', 'фанк',
      'джазовый', 'джаз дэнс', 'jazz dance', 'джазовая хореография',
      'клиповый танец', 'видеоклип', 'эмоциональный танец'
    ],
    
    // Contemporary
    'contemporary': [
      'контемпорари', 'контемп', 'contemp', 'contemporary dance',
      'современный танец', 'модерн', 'modern', 'контемпорари дэнс',
      'эмоциональный', 'сценический', 'пластика', 'естественные движения'
    ],
    
    // High Heels
    'high-heels': [
      'высокие каблуки', 'на каблуках', 'highheels', 'high heels',
      'хилс', 'heels', 'каблуки', 'женский танец на каблуках',
      'сексуальный танец', 'женственный', 'грация'
    ],
    
    // Latina
    'latina': [
      'латина', 'латино', 'латиноамериканские', 'сальса', 'бачата',
      'меренге', 'реггетон', 'reggaeton', 'латиноамериканские танцы',
      'сальса', 'salsa', 'бачата', 'bachata', 'меренге', 'merengue',
      'парные танцы', 'социальные танцы', 'зажигательные'
    ],
    
    // Twerk
    'twerk': [
      'тверк', 'твёрк', 'тверкинг', 'twerking', 'бути дэнс',
      'booty dance', 'танец бедрами', 'изоляция бедер',
      'бедра', 'ягодицы', 'нижняя часть тела'
    ],
    
    // Strip Dance
    'strip-dance': [
      'стрип пластика', 'стрип', 'strip dance', 'стрипданс',
      'стриптиз', 'striptease', 'пластика', 'грация',
      'чувственный', 'женственный', 'раскрепощение'
    ],
    
    // Break Dance
    'break-dance': [
      'брейк-данс', 'брейкданс', 'breakdance', 'брейк',
      'breaking', 'би-боинг', 'b-boying', 'брейкинг',
      'нижний брейк', 'верхний брейк', 'акробатика',
      'силовой танец', 'уличная акробатика'
    ],
    
    // Другие популярные
    'ballet': ['балет', 'классический танец', 'пуанты', 'классика'],
    'modern': ['модерн', 'модерн-танец', 'модерн дэнс'],
    'jazz': ['джаз-танец', 'джаз танцы', 'джаз модерн'],
    'street-dance': ['уличные танцы', 'стрит дэнс', 'уличный стиль'],
    'folk': ['народные танцы', 'фолк', 'народный', 'традиционные'],
    'ballroom': ['бальные танцы', 'бальные', 'спортивные бальные'],
    'salsa': ['сальса', 'кубинская сальса', 'латина сальса'],
    'bachata': ['бачата', 'доминиканская бачата'],
    'reggaeton': ['реггетон', 'реггитон', 'реггетон дэнс'],
    'dancehall': ['дэнсхолл', 'дансхолл', 'dancehall', 'ямайка'],
    'vogue': ['вог', 'вогинг', 'vogue', 'voguing'],
    'krump': ['крамп', 'крампинг', 'krump', 'кранк'],
    'locking': ['локинг', 'locking', 'замки'],
    'popping': ['поппинг', 'паппинг', 'popping', 'волны'],
    'house': ['хаус', 'хаус дэнс', 'house dance'],
    'waacking': ['вэкинг', 'вэккинг', 'waacking'],
    'k-pop': ['кей-поп', 'кпоп', 'kpop', 'корейские танцы'],
    'zumba': ['зумба', 'zumba', 'фитнес танцы'],
    'belly-dance': ['танец живота', 'белли дэнс', 'восточные танцы'],
    'pole-dance': ['пилон', 'пол дэнс', 'танец на шесте', 'шест'],
    'aerial': ['воздушные', 'полотна', 'воздушная гимнастика', 'кольца'],
    'tap-dance': ['чечётка', 'тэп дэнс', 'тап дэнс', 'степ']
  }
};

// ============ ОСНОВНЫЕ ФУНКЦИИ ============

// Поиск направления по любому варианту названия
export function findDirection(query) {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Сначала ищем в доступных направлениях
  for (const [key, direction] of Object.entries(ALL_DANCE_DIRECTIONS.available)) {
    // Проверяем прямое совпадение
    if (key === normalizedQuery || direction.name.toLowerCase().includes(normalizedQuery)) {
      return {
        found: true,
        available: true,
        direction: direction,
        key: key
      };
    }
    
    // Проверяем варианты поиска
    if (ALL_DANCE_DIRECTIONS.searchVariations[key]) {
      for (const variation of ALL_DANCE_DIRECTIONS.searchVariations[key]) {
        if (variation === normalizedQuery || 
            normalizedQuery.includes(variation) || 
            variation.includes(normalizedQuery)) {
          return {
            found: true,
            available: true,
            direction: direction,
            key: key
          };
        }
      }
    }
  }
  
  // Ищем в недоступных направлениях
  for (const [key, direction] of Object.entries(ALL_DANCE_DIRECTIONS.not_available)) {
    // Проверяем прямое совпадение
    if (key === normalizedQuery || direction.name.toLowerCase().includes(normalizedQuery)) {
      return {
        found: true,
        available: false,
        direction: direction,
        key: key
      };
    }
    
    // Проверяем варианты поиска
    if (ALL_DANCE_DIRECTIONS.searchVariations[key]) {
      for (const variation of ALL_DANCE_DIRECTIONS.searchVariations[key]) {
        if (variation === normalizedQuery || 
            normalizedQuery.includes(variation) || 
            variation.includes(normalizedQuery)) {
          return {
            found: true,
            available: false,
            direction: direction,
            key: key
          };
        }
      }
    }
  }
  
  // Не найдено
  return {
    found: false,
    available: false,
    direction: null,
    key: null
  };
}

// Получить список всех доступных направлений
export function getAvailableDirections() {
  return Object.values(ALL_DANCE_DIRECTIONS.available).map(dir => dir.name);
}

// Получить список популярных направлений
export function getPopularDirections() {
  const popular = [];
  for (const [key, direction] of Object.entries(ALL_DANCE_DIRECTIONS.available)) {
    if (direction.popularity === 'Очень высокая' || direction.popularity === 'Высокая') {
      popular.push(direction.name);
    }
  }
  return popular;
}

// Получить направления по категории
export function getDirectionsByCategory(category) {
  const result = [];
  for (const [key, direction] of Object.entries(ALL_DANCE_DIRECTIONS.available)) {
    if (direction.tags && direction.tags.includes(category)) {
      result.push(direction.name);
    }
  }
  return result;
}

// Получить полную информацию о направлении по названию
export function getDirectionInfo(name) {
  // Ищем в доступных
  for (const [key, direction] of Object.entries(ALL_DANCE_DIRECTIONS.available)) {
    if (direction.name.toLowerCase() === name.toLowerCase() || 
        key.toLowerCase() === name.toLowerCase()) {
      return {
        ...direction,
        available: true
      };
    }
  }
  
  // Ищем в недоступных
  for (const [key, direction] of Object.entries(ALL_DANCE_DIRECTIONS.not_available)) {
    if (direction.name.toLowerCase() === name.toLowerCase() || 
        key.toLowerCase() === name.toLowerCase()) {
      return {
        ...direction,
        available: false
      };
    }
  }
  
  return null;
}

// Поиск направлений по тегам
export function searchDirectionsByTags(tags) {
  const results = [];
  const tagArray = Array.isArray(tags) ? tags : [tags];
  
  for (const [key, direction] of Object.entries(ALL_DANCE_DIRECTIONS.available)) {
    if (direction.tags && tagArray.some(tag => direction.tags.includes(tag))) {
      results.push({
        name: direction.name,
        key: key,
        tags: direction.tags,
        popularity: direction.popularity
      });
    }
  }
  
  return results;
}

// Получить все теги для фильтрации
export function getAllTags() {
  const tags = new Set();
  
  for (const direction of Object.values(ALL_DANCE_DIRECTIONS.available)) {
    if (direction.tags) {
      direction.tags.forEach(tag => tags.add(tag));
    }
  }
  
  return Array.from(tags);
}

// Рекомендация направлений на основе предпочтений
export function recommendDirection(preferences) {
  const recommendations = [];
  
  for (const [key, direction] of Object.entries(ALL_DANCE_DIRECTIONS.available)) {
    let score = 0;
    
    if (preferences.gender === 'female' && direction.tags.includes('женские')) {
      score += 3;
    }
    
    if (preferences.gender === 'male' && direction.tags.includes('мужские')) {
      score += 3;
    }
    
    if (preferences.energy === 'high' && direction.tags.includes('энергичные')) {
      score += 2;
    }
    
    if (preferences.energy === 'low' && direction.tags.includes('пластичные')) {
      score += 2;
    }
    
    if (preferences.style === 'street' && direction.tags.includes('уличные')) {
      score += 3;
    }
    
    if (preferences.style === 'elegant' && direction.tags.includes('грация')) {
      score += 3;
    }
    
    if (preferences.partner === 'yes' && direction.tags.includes('парные')) {
      score += 4;
    }
    
    if (preferences.partner === 'no' && !direction.tags.includes('парные')) {
      score += 2;
    }
    
    if (score > 0) {
      recommendations.push({
        name: direction.name,
        key: key,
        score: score,
        description: direction.description.substring(0, 100) + '...'
      });
    }
  }
  
  // Сортируем по убыванию баллов
  recommendations.sort((a, b) => b.score - a.score);
  
  return recommendations.slice(0, 3); // Топ-3 рекомендации
}

// Статистика базы направлений
export function getDirectionsStats() {
  return {
    total_available: Object.keys(ALL_DANCE_DIRECTIONS.available).length,
    total_not_available: Object.keys(ALL_DANCE_DIRECTIONS.not_available).length,
    total_all: Object.keys(ALL_DANCE_DIRECTIONS.available).length + 
               Object.keys(ALL_DANCE_DIRECTIONS.not_available).length,
    popular_count: getPopularDirections().length,
    tags_count: getAllTags().length,
    categories: ['уличные', 'современные', 'женские', 'парные', 'классические', 'фитнес']
  };
}

// Экспорт всей базы (для отладки)
export function getAllDirections() {
  return ALL_DANCE_DIRECTIONS;
}

// Получить направление по ключу
export function getDirectionByKey(key) {
  if (ALL_DANCE_DIRECTIONS.available[key]) {
    return {
      ...ALL_DANCE_DIRECTIONS.available[key],
      available: true
    };
  }
  
  if (ALL_DANCE_DIRECTIONS.not_available[key]) {
    return {
      ...ALL_DANCE_DIRECTIONS.not_available[key],
      available: false
    };
  }
  
  return null;
}

// Проверить, доступно ли направление
export function isDirectionAvailable(directionName) {
  const result = findDirection(directionName);
  return result.found && result.available;
}

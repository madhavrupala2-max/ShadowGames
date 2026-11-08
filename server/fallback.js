'use strict';
// Tiny emergency bank, used ONLY when the AI is unreachable / key missing. [hi q, hi opts, en q, en opts, answerIndex]
const R = [
  ['भारत की राजधानी क्या है?', ['मुंबई', 'नई दिल्ली', 'कोलकाता', 'चेन्नई'], 'What is the capital of India?', ['Mumbai', 'New Delhi', 'Kolkata', 'Chennai'], 1],
  ['इंद्रधनुष में कितने रंग होते हैं?', ['5', '6', '7', '8'], 'How many colours are there in a rainbow?', ['5', '6', '7', '8'], 2],
  ['सूरज किस दिशा में उगता है?', ['पश्चिम', 'पूर्व', 'उत्तर', 'दक्षिण'], 'In which direction does the Sun rise?', ['West', 'East', 'North', 'South'], 1],
  ['भारत का राष्ट्रीय पक्षी कौन सा है?', ['कौआ', 'तोता', 'मोर', 'कबूतर'], 'Which is the national bird of India?', ['Crow', 'Parrot', 'Peacock', 'Pigeon'], 2],
  ['एक हफ्ते में कितने दिन होते हैं?', ['5', '6', '7', '8'], 'How many days are there in a week?', ['5', '6', '7', '8'], 2],
  ['पानी जमने पर क्या बन जाता है?', ['बर्फ', 'भाप', 'धुआँ', 'रेत'], 'What does water turn into when it freezes?', ['Ice', 'Steam', 'Smoke', 'Sand'], 0],
  ['हमें दूध किस जानवर से मिलता है?', ['शेर', 'गाय', 'मगरमच्छ', 'साँप'], 'Which animal gives us milk?', ['Lion', 'Cow', 'Crocodile', 'Snake'], 1],
  ['रात को आसमान में कौन सा बड़ा गोल चमकता दिखता है?', ['सूरज', 'इंद्रधनुष', 'चाँद', 'बादल'], 'Which big round thing shines in the night sky?', ['Sun', 'Rainbow', 'Moon', 'Cloud'], 2],
  ['5 + 3 कितना होता है?', ['6', '7', '8', '9'], 'What is 5 + 3?', ['6', '7', '8', '9'], 2],
  ['हमारे तिरंगे में सबसे ऊपर कौन सा रंग होता है?', ['हरा', 'सफेद', 'नीला', 'केसरिया'], 'Which colour is at the top of our national flag?', ['Green', 'White', 'Blue', 'Saffron'], 3],
  ['इनमें से कौन सा फल पीला होता है?', ['स्ट्रॉबेरी', 'केला', 'तरबूज', 'जामुन'], 'Which of these fruits is yellow?', ['Strawberry', 'Banana', 'Watermelon', 'Jamun'], 1],
  ['मकड़ी के कितने पैर होते हैं?', ['4', '6', '8', '10'], 'How many legs does a spider have?', ['4', '6', '8', '10'], 2],
  ['सबसे ऊँचा जानवर कौन सा है?', ['हाथी', 'जिराफ', 'घोड़ा', 'ऊँट'], 'Which is the tallest animal?', ['Elephant', 'Giraffe', 'Horse', 'Camel'], 1],
  ['दिवाली किसका त्योहार है?', ['रंगों का', 'पतंगों का', 'रोशनी का', 'फूलों का'], 'Diwali is the festival of what?', ['Colours', 'Kites', 'Lights', 'Flowers'], 2],
  ['साँस लेने के लिए हमें क्या चाहिए?', ['पत्थर', 'हवा', 'लकड़ी', 'लोहा'], 'What do we need to breathe?', ['Stone', 'Air', 'Wood', 'Iron'], 1],
  ['10 − 4 कितना होता है?', ['5', '6', '7', '8'], 'What is 10 − 4?', ['5', '6', '7', '8'], 1],
  ['ताजमहल किस शहर में है?', ['जयपुर', 'दिल्ली', 'आगरा', 'लखनऊ'], 'In which city is the Taj Mahal?', ['Jaipur', 'Delhi', 'Agra', 'Lucknow'], 2],
  ['ट्रैफिक सिग्नल पर रुकने के लिए कौन सी बत्ती जलती है?', ['हरी', 'लाल', 'पीली', 'नीली'], 'Which traffic light means STOP?', ['Green', 'Red', 'Yellow', 'Blue'], 1],
];
module.exports = R.map(([hq, ho, eq, eo, a]) => ({ hi: { q: hq, o: ho }, en: { q: eq, o: eo }, a }));

'use strict';
// Small offline question bank, used ONLY when Gemini is unavailable (no key / no internet).
// Format: [ 'question hindi|question english', 'opt1hi|opt1en;opt2hi|opt2en;...', correctIndex ]
const RAW = [
  ['भारत की राजधानी क्या है?|What is the capital of India?', 'दिल्ली|Delhi;मुंबई|Mumbai;कोलकाता|Kolkata;चेन्नई|Chennai', 0],
  ['सूरज किस दिशा में उगता है?|In which direction does the sun rise?', 'पूर्व|East;पश्चिम|West;उत्तर|North;दक्षिण|South', 0],
  ['इंद्रधनुष में कितने रंग होते हैं?|How many colours are in a rainbow?', '5|5;7|7;9|9;12|12', 1],
  ['सबसे बड़ा जानवर कौन सा है?|Which is the biggest animal?', 'हाथी|Elephant;नीली व्हेल|Blue whale;शेर|Lion;जिराफ|Giraffe', 1],
  ['एक हफ्ते में कितने दिन होते हैं?|How many days are in a week?', '5|5;6|6;7|7;8|8', 2],
  ['भारत का राष्ट्रीय पक्षी कौन सा है?|What is the national bird of India?', 'मोर|Peacock;तोता|Parrot;कबूतर|Pigeon;कौआ|Crow', 0],
  ['पानी जमकर क्या बन जाता है?|What does water become when it freezes?', 'बर्फ|Ice;भाप|Steam;धुआँ|Smoke;रेत|Sand', 0],
  ['चाँद पर सबसे पहले कदम किसने रखा?|Who first walked on the Moon?', 'नील आर्मस्ट्रांग|Neil Armstrong;राकेश शर्मा|Rakesh Sharma;कल्पना चावला|Kalpana Chawla;यूरी गागरिन|Yuri Gagarin', 0],
  ['5 + 7 कितना होता है?|What is 5 + 7?', '10|10;11|11;12|12;13|13', 2],
  ['कौन सा फल आमतौर पर पीला होता है?|Which fruit is usually yellow?', 'केला|Banana;अंगूर|Grapes;तरबूज़|Watermelon;जामुन|Jamun', 0],
  ['गाय हमें क्या देती है?|What does a cow give us?', 'दूध|Milk;अंडे|Eggs;शहद|Honey;ऊन|Wool', 0],
  ['तिरंगे में कितने रंग होते हैं?|How many colours are in the Indian tricolour?', '2|2;3|3;4|4;5|5', 1],
  ['किस ग्रह को लाल ग्रह कहते हैं?|Which planet is called the Red Planet?', 'मंगल|Mars;शुक्र|Venus;बृहस्पति|Jupiter;शनि|Saturn', 0],
  ['बिल्ली कैसी आवाज़ करती है?|What sound does a cat make?', 'म्याऊँ|Meow;भौं भौं|Woof;मूँ|Moo;टर्र टर्र|Ribbit', 0],
  ['पौधे अपना खाना बनाने के लिए क्या इस्तेमाल करते हैं?|What do plants use to make their food?', 'धूप|Sunlight;रेत|Sand;पत्थर|Stone;चीनी|Sugar', 0],
  ['ताजमहल किस शहर में है?|In which city is the Taj Mahal?', 'आगरा|Agra;जयपुर|Jaipur;दिल्ली|Delhi;लखनऊ|Lucknow', 0],
  ['दीवाली किसका त्योहार है?|Diwali is the festival of what?', 'रोशनी|Lights;पतंग|Kites;नावें|Boats;बर्फ|Snow', 0],
  ['एक हाथ में कुल कितनी उँगलियाँ होती हैं?|How many fingers are on one hand (with thumb)?', '4|4;5|5;6|6;10|10', 1],
  ['दुनिया का सबसे ऊँचा पर्वत कौन सा है?|Which is the highest mountain in the world?', 'माउंट एवरेस्ट|Mount Everest;कंचनजंगा|Kanchenjunga;नंदा देवी|Nanda Devi;फ़ूजी|Mount Fuji', 0],
  ['जंगल का राजा किसे कहते हैं?|Which animal is called the King of the Jungle?', 'शेर|Lion;हाथी|Elephant;भालू|Bear;बंदर|Monkey', 0],
  ['10 − 4 कितना होता है?|What is 10 − 4?', '5|5;6|6;7|7;8|8', 1],
  ['इनमें से कौन उड़ सकता है?|Which of these can fly?', 'तोता|Parrot;कुत्ता|Dog;गाय|Cow;हाथी|Elephant', 0],
  ['एक साल में कितने महीने होते हैं?|How many months are in a year?', '10|10;11|11;12|12;13|13', 2],
  ['हम किससे देखते हैं?|What do we use to see?', 'आँखें|Eyes;कान|Ears;नाक|Nose;जीभ|Tongue', 0]
];

const fallbackBank = () => RAW.map(([q, o, a]) => {
  const [qh, qe] = q.split('|');
  const opts = o.split(';').map(x => x.split('|'));
  return { qh, qe, oh: opts.map(x => x[0]), oe: opts.map(x => x[1]), a };
});

module.exports = { fallbackBank };

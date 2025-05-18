const express = require("express");
const app = express();
const errorHandler = require('errorhandler');
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT, 10) || 8080;
const publicDir = process.argv[2] || __dirname + '/public';
const { OpenAI } = require("openai");
const dotenv = require('dotenv');
dotenv.config();
const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

app.use(express.json({limit: '50mb'}));
app.use(express.static(publicDir));
app.use(errorHandler({ dumpExceptions: true, showStack: true}));

console.log("Imagine server running at " + hostname + ":" + port);

let state = {"interim": "What can you imagine?", "final": "", "src": ""};
let testMode = false;

function generate(prompt) {
  return openai.images.generate({
    model: "dall-e-3", prompt, n: 1, size: "1792x1024"
  }).then((response) => {
    return response.data[0].url;
  }).catch((error) => {
    console.log(error);
    return null;
  });
}

async function generate_product_link(imageBase64) {
  try {
    console.log('=== STARTING OPENAI REQUEST ===');
    console.log('Image base64 length:', imageBase64.length);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What product is featured in this video frame? Just describe the product name and brand if visible, nothing else." },
            { type: "image_url", image_url: { "url": `data:image/jpeg;base64,${imageBase64}` } }
          ]
        }
      ],
      max_tokens: 300
    });
    
    console.log('=== OPENAI RESPONSE RECEIVED ===');
    console.log('Raw response:', JSON.stringify(response, null, 2));
    
    const productName = response.choices[0]?.message?.content?.trim() || "";
    console.log('Product name:', productName);
    
    // Create a Google search URL for the product
    const searchQuery = encodeURIComponent(productName + " buy");
    const googleSearchUrl = `https://www.google.com/search?q=${searchQuery}`;
    console.log('Generated search URL:', googleSearchUrl);
    
    return { 
      link: googleSearchUrl, 
      response: `Found: ${productName}. Click to search on Google.`
    };
  } catch (error) {
    console.error('=== OPENAI ERROR ===');
    console.error('Error details:', error);
    return { link: null, response: 'Error: ' + error.message };
  }
}

async function test() {
  const wait = new Promise((resolve) => {
    setTimeout(() => resolve("images/fish.jpg"), 5000);
  });
  const result = await wait;
  return result;
}

app.post('/api/product-link', async (req, res) => {
  console.log('=== RECEIVED PRODUCT LINK REQUEST ===');
  const { imageBase64 } = req.body;
  
  if (!imageBase64) {
    console.log('Missing image data');
    return res.json({ link: null, response: 'Error: Missing image data' });
  }
  
  console.log('Calling generate_product_link...');
  const result = await generate_product_link(imageBase64);
  console.log('=== SENDING RESPONSE TO CLIENT ===');
  console.log('Result:', result);
  res.json(result);
});

app.listen(port, '0.0.0.0');

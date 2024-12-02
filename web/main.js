import { streamGemini } from './gemini-api.js';

let form = document.querySelector('form');
let imageUpload = document.querySelector('#imageUpload');
let output = document.querySelector('.output');
let imagePreview = document.querySelector('.image-preview');
let tagCountInput = document.querySelector('#tagCount');
let downloadCSVButton = document.querySelector('#downloadCSV');

let imageData = [];

const categoryMapping = {
  1: 'Animals',
  2: 'Buildings and Architecture',
  3: 'Business',
  4: 'Drinks',
  5: 'The Environment',
  6: 'States of Mind',
  7: 'Food',
  8: 'Graphic Resources',
  9: 'Hobbies and Leisure',
  10: 'Industry',
  11: 'Landscapes',
  12: 'Lifestyle',
  13: 'People',
  14: 'Plants and Flowers',
  15: 'Culture and Religion',
  16: 'Science',
  17: 'Social Issues',
  18: 'Sports',
  19: 'Technology',
  20: 'Transport',
  21: 'Travel'
};

async function processImages(files) {
  output.textContent = 'Generating...';
  imagePreview.innerHTML = '';
  imageData = [];

  if (!files || files.length === 0) {
    output.textContent = 'No images selected.';
    return;
  }

  const tagCount = Number(tagCountInput.value);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const imageUrl = await readFileAsDataURL(file);
    const imageBase64 = imageUrl.split(',')[1];

    try {
      const prompt = `Generate "25" words detailed title for the image, If you cannot generate 25 words Title, fill in the remaining title with camera position, effect, background element detail. Provide EXACTLY ${tagCount} comma-separated tags for the image. If you cannot generate ${tagCount} tags, fill in the remaining tags with highly relevant keywords. Also, write a Detailed description. Mention specific elements, Setting, Objects, Mood, Colors, Background Elements, View Position, Subject, Lighting, Image Style, Mood/Atmosphere, Texture/Material, Action/Movement, Weather/Environment, Perspective, Artistic Effects, Character Features, Time Period, Culture/Region, Season, Symbolism, Interaction, Emphasis/Focus, Sound/Feeling Association, Patterns/Shapes, Edges/Framing, Decor/Ornamentation, Contrast, Scale/Proportion, Narrative Elements, Light Interaction, Energy/Vibes, Natural Phenomena, Technological Details, Biological/Organic Forms, Skin Detail, Fantasy/Mythical Elements, classify this image into one of the following categories by number:
        1. Animals
        2. Buildings and Architecture
        3. Business
        4. Drinks
        5. The Environment
        6. States of Mind
        7. Food
        8. Graphic Resources
        9. Hobbies and Leisure
        10. Industry
        11. Landscapes
        12. Lifestyle
        13. People
        14. Plants and Flowers
        15. Culture and Religion
        16. Science
        17. Social Issues
        18. Sports
        19. Technology
        20. Transport
        21. Travel

        Respond in the format:
        Title: [Generated Title]
        Tags: [Comma-separated tags]
        Description: [Generated Description]
        Category: [Category Number]`;

      let contents = [
        {
          role: 'user',
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
            { text: prompt }
          ]
        }
      ];

      let stream = streamGemini({
        model: 'gemini-1.5-flash',
        contents,
      });

      let buffer = [];
      for await (let chunk of stream) {
        buffer.push(chunk);
      }

      let responseText = buffer.join('');
      console.log('Raw API Response:', responseText);

      let titleMatch = responseText.match(/Title:\s*(.*)\n/);
      let tagsMatch = responseText.match(/Tags:\s*(.*)\n/);
      let descriptionMatch = responseText.match(/Description:\s*(.*)/);
      let categoryMatch = responseText.match(/Category:\s*(\d+)/);

      // Extract title and add suffix if PNG
      let cleanTitle = titleMatch ? titleMatch[1].replace(/(\*\*|\*|_|\n|\r)/g, '').trim() : '';
      if (file.type === 'image/png') {
          // Remove "isolated on black background" (or similar) and add the correct suffix
          cleanTitle = cleanTitle.replace(/isolated on (black|white|transparent|any) background/gi, '').trim(); 
          // Add "isolated on transparent or white background" if it's not already present
          if (!/isolated on (transparent|white) background/gi.test(cleanTitle)) {
              cleanTitle += ' isolated on transparent or white background';
          }
      }
      let cleanTags = tagsMatch ? tagsMatch[1].replace(/(\*\*|\*|_|\n|\r)/g, '').trim() : '';
      let cleanDescription = descriptionMatch ? descriptionMatch[1].replace(/(\*\*|\*|_|\n|\r)/g, '').trim() : '';
      let detectedCategory = categoryMatch ? parseInt(categoryMatch[1], 10) : null;
      let detectedCategoryName = categoryMapping[detectedCategory] || "Unknown";

      let tagArray = cleanTags.split(',').map(tag => tag.trim());

      // Validate and fix tag count
      if (tagArray.length > tagCount) {
        tagArray = tagArray.slice(0, tagCount); // Truncate if too many
      } else if (tagArray.length < tagCount) {
        while (tagArray.length < tagCount) {
          tagArray.push('placeholder'); // Add placeholders if too few (customize as needed)
        }
      }

      let correctedTags = tagArray.join(', ');
      let tagCountGenerated = tagArray.length; // Update the count after correction

      imageData.push({
        filename: file.name,
        title: cleanTitle,
        keywords: correctedTags,
        description: cleanDescription,
        tagCount: tagCountGenerated,
        categoryNumber: detectedCategory,
        categoryName: detectedCategoryName
      });

      const imageContainer = document.createElement('div');
      imageContainer.classList.add('image-container');
      imageContainer.innerHTML = `
                <img src="${imageUrl}" alt="${file.name}">
                <div class="meta">
                    <div class="meta-item">
                        <h4>Title:</h4>
                        <p>${cleanTitle}</p>
                        <button class="copy-btn" data-copy="${cleanTitle}">Copy</button>
                    </div>
                    <div class="meta-item">
                        <h4>Description:</h4>
                        <p>${cleanDescription}</p>
                        <button class="copy-btn" data-copy="${cleanDescription}">Copy</button>
                    </div>
                    <div class="meta-item">
                        <h4>Tags (${tagCountGenerated}):</h4>
                        <p>${correctedTags}</p>
                        <button class="copy-btn" data-copy="${correctedTags}">Copy</button>
                    </div>
                    <div class="meta-item">
                        <h4>Category:</h4>
                        <p>${detectedCategoryName}</p> 
                    </div>
                </div>
            `;
      imagePreview.appendChild(imageContainer);

      output.innerHTML = `Processed ${i + 1} of ${files.length} images.`;
    } catch (e) {
      output.innerHTML += '<hr>' + e;
    }
  }

  output.innerHTML += '<hr>Metadata generated. Click "Download CSV" to save.';
};

form.onsubmit = async (ev) => {
  ev.preventDefault();
  processImages(imageUpload.files);
};

const dropArea = document.getElementById('drop-area');
dropArea.addEventListener('drop', (event) => {
  event.preventDefault();
  dropArea.classList.remove('highlight');
  processImages(event.dataTransfer.files);
});
['dragenter', 'dragover', 'dragleave'].forEach(eventName => {
  dropArea.addEventListener(eventName, (event) => event.preventDefault());
  dropArea.addEventListener(eventName, () => dropArea.classList.add('highlight'));
});
dropArea.addEventListener('dragleave', () => dropArea.classList.remove('highlight'));

document.body.addEventListener('click', (event) => {
  if (event.target.classList.contains('copy-btn')) {
    const textToCopy = event.target.dataset.copy;
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        alert('Copied to clipboard!');
      })
      .catch((err) => console.error('Error copying text: ', err));
  }
});

downloadCSVButton.onclick = () => {
  let csvContent = "Filename,Title,Keywords,Description,Tag Count,Category,CategoryName\n";
  imageData.forEach(data => {
    const escapedTitle = data.title.replace(/"/g, '""');
    const escapedKeywords = data.keywords.replace(/"/g, '""');
    const escapedDescription = data.description.replace(/"/g, '""');
    const escapedCategoryName = data.categoryName.replace(/"/g, '""');
    csvContent += `${data.filename},"${escapedTitle}","${escapedKeywords}","${escapedDescription}",${data.tagCount},${data.categoryNumber},"${escapedCategoryName}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "image_data.csv";
  link.click();
};

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

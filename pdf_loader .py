import os
from langchain_community.document_loaders import PyPDFLoader

def convert_pdf_to_text(pdf_path):
    """
    A simple function that takes a PDF file path,
    extracts all the text using Langchain's PyPDFLoader,
    and returns the combined text.
    """
    if not os.path.exists(pdf_path):
        print(f"❌ Error: File not found at '{pdf_path}'")
        return None

    print(f"⏳ Extracting text from: {pdf_path}...")
    
    # 1. Initialize the PDF Loader
    loader = PyPDFLoader(pdf_path)
    
    # 2. Load the PDF (returns a list of Documents, one for each page)
    pages = loader.load()
    
    # 3. Combine the text from all pages
    full_text = ""
    for i, page in enumerate(pages):
        full_text += f"\n\n--- Page {i+1} ---\n\n"
        full_text += page.page_content
        
    return full_text

if __name__ == "__main__":
    # Folder to search for PDFs
    folder_path = "Physics"
    
    if not os.path.exists(folder_path):
        print(f"📁 Folder '{folder_path}' does not exist. Please create it and add PDFs.")
    else:
        # Check all files in the folder (including sub-folders)
        found_pdfs = []
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                if file.lower().endswith(".pdf"):
                    found_pdfs.append(os.path.join(root, file))
        
        if not found_pdfs:
            print(f"❌ No PDF files found in '{folder_path}' folder.")
        else:
            print(f"✅ Found {len(found_pdfs)} PDF(s) in '{folder_path}'. Starting extraction...\n")
            
            for pdf_file in found_pdfs:
                extracted_text = convert_pdf_to_text(pdf_file)
                
                if extracted_text:
                    # Save the extracted text to a .txt file in the same folder
                    base_name = os.path.splitext(pdf_file)[0]
                    output_txt_file = f"{base_name}_extracted.txt"
                    
                    with open(output_txt_file, "w", encoding="utf-8") as f:
                        f.write(extracted_text)
                        
                    print(f"✅ Saved extracted text to: {output_txt_file}\n")

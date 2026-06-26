import io
import re
import pypdf
from typing import Dict, Any, List, Tuple

class FontEngine:
    def __init__(self, cache_dir: str):
        self.cache_dir = cache_dir
        self.font_names: List[str] = []

    def clean_font_name(self, font_name: str) -> str:
        # Removes PDF subset prefixes (e.g. 'ABCDEF+Arial-BoldMT' -> 'Arial-BoldMT')
        cleaned = re.sub(r'^[A-Z]{6}\+', '', font_name)
        # Remove slash prefix if present
        cleaned = cleaned.lstrip('/')
        return cleaned

    def extract_all_fonts(self, doc_bytes: bytes) -> List[str]:
        """
        Scans PDF structure dictionary objects to find font names used in page resources.
        """
        font_names_set = set()
        try:
            reader = pypdf.PdfReader(io.BytesIO(doc_bytes))
            for page in reader.pages:
                if '/Resources' in page and '/Font' in page['/Resources']:
                    fonts_dict = page['/Resources']['/Font']
                    # fonts_dict is a dictionary of Font objects
                    for font_alias in fonts_dict:
                        font_obj = fonts_dict[font_alias]
                        # Resolve indirect objects
                        if hasattr(font_obj, 'get_object'):
                            font_obj = font_obj.get_object()
                        
                        if '/BaseFont' in font_obj:
                            font_names_set.add(str(font_obj['/BaseFont']))
        except Exception as e:
            print(f"Error scanning PDF fonts in pypdf: {e}")
            
        self.font_names = list(font_names_set)
        return self.font_names

    def get_font_css(self, font_name: str, server_url: str) -> str:
        """
        Returns webfont CSS rule. Since we are in pure-Python, we map font names
        to system fallbacks or dynamic Webfonts.
        """
        cleaned_name = self.clean_font_name(font_name)
        
        # We can map standard fonts directly
        css = f"""
/* Font Mapping: {font_name} -> {cleaned_name} */
.font-name-{font_name.replace('+', '_').replace('-', '_')} {{
    font-family: "{cleaned_name}", "Inter", sans-serif;
}}
"""
        return css

    def get_fallback_font(self, font_name: str) -> Tuple[str, str]:
        cleaned = self.clean_font_name(font_name).lower()
        is_bold = "bold" in cleaned or "black" in cleaned or "heavy" in cleaned
        is_italic = "italic" in cleaned or "oblique" in cleaned or "slanted" in cleaned
        
        if "sans" in cleaned or "arial" in cleaned or "helvetica" in cleaned or "calibri" in cleaned:
            family = "Arial, Helvetica, sans-serif"
        elif "serif" in cleaned or "times" in cleaned or "georgia" in cleaned or "roman" in cleaned:
            family = "Georgia, 'Times New Roman', serif"
        elif "mono" in cleaned or "courier" in cleaned or "consolas" in cleaned:
            family = "monospace"
        else:
            family = "sans-serif"
            
        style = "normal"
        weight = "normal"
        if is_bold:
            weight = "bold"
        if is_italic:
            style = "italic"
            
        return family, f"font-weight: {weight}; font-style: {style};"

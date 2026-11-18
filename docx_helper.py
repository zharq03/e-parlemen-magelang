import zipfile
import os

def esc(text):
    if text is None:
        return ""
    return (str(text)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&apos;'))

class DocxBuilder:
    def __init__(self):
        self.elements = []

    def p(self, text, bold=False, italic=False, color="1F2937", size=21, align="left", space_before=0, space_after=120):
        jc = f'<w:jc w:val="{align}"/>' if align != "left" else ""
        b_tag = "<w:b/>" if bold else ""
        i_tag = "<w:i/>" if italic else ""
        xml = f"""<w:p>
  <w:pPr>
    {jc}
    <w:spacing w:before="{space_before}" w:after="{space_after}" w:line="276" w:lineRule="auto"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI"/>
      {b_tag}
      {i_tag}
      <w:sz w:val="{size}"/>
      <w:color w:val="{color}"/>
    </w:rPr>
    <w:t xml:space="preserve">{esc(text)}</w:t>
  </w:r>
</w:p>"""
        self.elements.append(xml)

    def heading1(self, text):
        self.p(text, bold=True, color="0F2E22", size=32, space_before=360, space_after=180)

    def heading2(self, text):
        self.p(text, bold=True, color="1D4A37", size=26, space_before=240, space_after=120)

    def heading3(self, text):
        self.p(text, bold=True, color="2D3748", size=22, space_before=180, space_after=80)

    def lead(self, text):
        self.p(text, italic=True, color="4B5563", size=21, space_before=0, space_after=140)

    def callout(self, title, text):
        xml = f"""<w:tbl>
  <w:tblPr>
    <w:tblW w:w="5000" w:type="pct"/>
    <w:tblBorders>
      <w:top w:val="none"/>
      <w:left w:val="single" w:sz="24" w:space="0" w:color="C9A84C"/>
      <w:bottom w:val="none"/>
      <w:right w:val="none"/>
    </w:tblBorders>
    <w:tblCellMar>
      <w:top w:w="120" w:type="dxa"/>
      <w:left w:w="200" w:type="dxa"/>
      <w:bottom w:w="120" w:type="dxa"/>
      <w:right w:w="160" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>
  <w:tr>
    <w:tc>
      <w:tcPr>
        <w:shd w:val="clear" w:color="auto" w:fill="FAF8F2"/>
      </w:tcPr>
      <w:p>
        <w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Segoe UI"/><w:b/><w:color w:val="8C6A28"/><w:sz w:val="21"/></w:rPr><w:t>{esc(title)}</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr><w:spacing w:before="0" w:after="0"/><w:line w:line="260" w:lineRule="auto"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Segoe UI"/><w:color w:val="374151"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{esc(text)}</w:t></w:r>
      </w:p>
    </w:tc>
  </w:tr>
</w:tbl>"""
        self.elements.append(xml)
        self.p("", space_after=80)

    def code_block(self, code_text):
        escaped_lines = [esc(line) for line in code_text.strip().split("\n")]
        runs = []
        for line in escaped_lines:
            runs.append(f"""<w:p>
  <w:pPr><w:spacing w:before="0" w:after="20"/></w:pPr>
  <w:r>
    <w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/><w:color w:val="1F2937"/></w:rPr>
    <w:t xml:space="preserve">{line}</w:t>
  </w:r>
</w:p>""")
        joined_runs = "\n".join(runs)
        xml = f"""<w:tbl>
  <w:tblPr>
    <w:tblW w:w="5000" w:type="pct"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="6" w:space="0" w:color="E5E7EB"/>
      <w:left w:val="single" w:sz="6" w:space="0" w:color="E5E7EB"/>
      <w:bottom w:val="single" w:sz="6" w:space="0" w:color="E5E7EB"/>
      <w:right w:val="single" w:sz="6" w:space="0" w:color="E5E7EB"/>
    </w:tblBorders>
    <w:tblCellMar>
      <w:top w:w="120" w:type="dxa"/>
      <w:left w:w="160" w:type="dxa"/>
      <w:bottom w:w="120" w:type="dxa"/>
      <w:right w:w="160" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>
  <w:tr>
    <w:tc>
      <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
      {joined_runs}
    </w:tc>
  </w:tr>
</w:tbl>"""
        self.elements.append(xml)
        self.p("", space_after=100)

    def table(self, headers, rows, col_widths=None, header_bg="1D4A37"):
        tbl_header_cells = []
        for idx, h in enumerate(headers):
            w_tag = f'<w:tcW w:w="{col_widths[idx]}" w:type="dxa"/>' if col_widths and idx < len(col_widths) else ""
            tbl_header_cells.append(f"""<w:tc>
  <w:tcPr>
    {w_tag}
    <w:shd w:val="clear" w:color="auto" w:fill="{header_bg}"/>
  </w:tcPr>
  <w:p>
    <w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Segoe UI"/><w:b/><w:sz w:val="19"/><w:color w:val="FFFFFF"/></w:rPr>
      <w:t xml:space="preserve">{esc(h)}</w:t>
    </w:r>
  </w:p>
</w:tc>""")
        header_row_xml = f"""<w:tr>
  <w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>
  {"".join(tbl_header_cells)}
</w:tr>"""

        data_rows_xml = []
        for r_idx, row in enumerate(rows):
            is_zebra = (r_idx % 2 == 1)
            shd_fill = "F4F8F5" if is_zebra else "FFFFFF"
            cell_xmls = []
            for c_idx, cell in enumerate(row):
                w_tag = f'<w:tcW w:w="{col_widths[c_idx]}" w:type="dxa"/>' if col_widths and c_idx < len(col_widths) else ""
                cell_xmls.append(f"""<w:tc>
  <w:tcPr>
    {w_tag}
    <w:shd w:val="clear" w:color="auto" w:fill="{shd_fill}"/>
  </w:tcPr>
  <w:p>
    <w:pPr><w:spacing w:before="50" w:after="50"/><w:line w:line="240" w:lineRule="auto"/></w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Segoe UI"/><w:sz w:val="19"/><w:color w:val="1F2937"/></w:rPr>
      <w:t xml:space="preserve">{esc(str(cell))}</w:t>
    </w:r>
  </w:p>
</w:tc>""")
            data_rows_xml.append(f"""<w:tr>
  <w:trPr><w:cantSplit/></w:trPr>
  {"".join(cell_xmls)}
</w:tr>""")

        xml = f"""<w:tbl>
  <w:tblPr>
    <w:tblW w:w="5000" w:type="pct"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
    </w:tblBorders>
    <w:tblCellMar>
      <w:top w:w="80" w:type="dxa"/>
      <w:left w:w="120" w:type="dxa"/>
      <w:bottom w:w="80" w:type="dxa"/>
      <w:right w:w="120" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>
  {header_row_xml}
  {"".join(data_rows_xml)}
</w:tbl>"""
        self.elements.append(xml)
        self.p("", space_after=100)

    def page_break(self):
        self.elements.append('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')

    def build_docx(self, output_path):
        body_content = "\n".join(self.elements)
        document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {body_content}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>"""

        content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

        rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr('[Content_Types].xml', content_types)
            z.writestr('_rels/.rels', rels)
            z.writestr('word/document.xml', document_xml)

        print(f"Generated {output_path} ({os.path.getsize(output_path)} bytes)")

print("DocxBuilder helper defined successfully.")

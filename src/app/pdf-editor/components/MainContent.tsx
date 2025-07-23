import React from 'react'

const MainContent = () => {
  return (
      <div className="flex-1 flex overflow-hidden relative bg-white">
        {/* Hidden file inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp"
          className="hidden"
        />
        <input
          type="file"
          ref={imageInputRef}
          onChange={handleImageFileUpload}
          accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.svg"
          className="hidden"
        />
        <input
          type="file"
          ref={appendFileInputRef}
          onChange={handleAppendDocument}
          accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp"
          className="hidden"
        />

        {/* Sidebar */}
        <PDFEditorSidebar
          viewState={viewState}
          documentState={documentState}
          pageState={pageState}
          elementCollections={elementCollections}
          onPageChange={handlePageChange}
          onPageDelete={handlePageDelete}
          onFileUpload={handleFileUploadIntercept}
          onAppendDocument={() => appendFileInputRef.current?.click()}
          onSidebarToggle={() =>
            setViewState((prev) => ({
              ...prev,
              isSidebarCollapsed: !prev.isSidebarCollapsed,
            }))
          }
          onTabChange={(tab) =>
            setViewState((prev) => ({ ...prev, activeSidebarTab: tab }))
          }
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-white">
          {/* ElementFormatDrawer */}
          <div className="relative z-40 transition-all duration-300">
            <ElementFormatDrawer />
          </div>

          {/* Floating Toolbars - Only show when PDF is loaded */}
          {documentState.url && !documentState.error && (
            <FloatingToolbar
              editorState={editorState}
              toolState={toolState}
              erasureState={erasureState}
              currentView={viewState.currentView}
              showDeletionRectangles={editorState.showDeletionRectangles}
              isSidebarCollapsed={viewState.isSidebarCollapsed}
              currentWorkflowStep={viewState.currentWorkflowStep}
              onToolChange={handleToolChange}
              onViewChange={(view) =>
                setViewState((prev) => ({ ...prev, currentView: view }))
              }
              onEditModeToggle={() =>
                setEditorState((prev) => ({
                  ...prev,
                  isEditMode: !prev.isEditMode,
                }))
              }
              onDeletionToggle={() =>
                setEditorState((prev) => ({
                  ...prev,
                  showDeletionRectangles: !prev.showDeletionRectangles,
                }))
              }
              onImageUpload={
                viewState.currentView !== "split" 
                  ? () => imageInputRef.current?.click()
                  : undefined
              }
            />
          )}

          {/* Erasure Settings Popup - Only show when PDF is loaded */}
          {erasureState.isErasureMode &&
            documentState.url &&
            !documentState.error && (
              <div
                className="absolute z-50 bg-white/95 backdrop-blur-sm shadow-lg border border-gray-200 p-4 rounded-lg transition-all duration-300"
                style={{
                  top: "340px", // Below the floating toolbar (80px + ~200px for toolbar height)
                  left: "16px", // Same left position as floating toolbar
                  minWidth: "280px",
                }}
              >
                <div className="space-y-3">
                  {/* Opacity */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 w-20">
                      Opacity:
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={erasureState.erasureSettings.opacity}
                      onChange={(e) =>
                        setErasureState((prev) => ({
                          ...prev,
                          erasureSettings: {
                            ...prev.erasureSettings,
                            opacity: parseFloat(e.target.value),
                          },
                        }))
                      }
                      className="flex-1 w-5"
                    />
                    <span className="text-xs text-gray-500 w-10">
                      {Math.round(erasureState.erasureSettings.opacity * 100)}%
                    </span>
                  </div>
                  {/* Page Background Color Picker */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 w-20">
                      Page BG:
                    </label>
                    <input
                      type="color"
                      value={
                        documentState.pdfBackgroundColor.startsWith("#")
                          ? documentState.pdfBackgroundColor
                          : rgbStringToHex(documentState.pdfBackgroundColor)
                      }
                      onChange={(e) => {
                        const newColor = e.target.value;
                        actions.updatePdfBackgroundColor(newColor);
                      }}
                      className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                    />
                    <span className="text-xs text-gray-500">
                      {documentState.pdfBackgroundColor}
                    </span>
                  </div>
                </div>
              </div>
            )}

          {/* Document Viewer */}
          <div
            className="flex-1 document-viewer document-container"
            ref={containerRef}
            style={{
              scrollBehavior: "smooth",
              overflow: "auto",
              paddingTop: "64px",
            }}
          >
            {documentState.error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-red-500 text-lg mb-2">Error</div>
                  <div className="text-gray-600">{documentState.error}</div>
                </div>
              </div>
            )}

            {!documentState.url && !documentState.error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-gray-500 text-lg mb-2">
                    No document loaded
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Upload Document
                  </button>
                </div>
              </div>
            )}

            {documentState.url && !documentState.error && (
              <div
                className="document-wrapper"
                style={{
                  minHeight: `${Math.max(
                    100,
                    documentState.pageHeight * documentState.scale + 80
                  )}px`,
                  height: `${Math.max(
                    100,
                    documentState.pageHeight * documentState.scale + 80
                  )}px`,
                  width: `${Math.max(
                    100,
                    viewState.currentView === "split"
                      ? documentState.pageWidth * documentState.scale * 2 + 100 // Double width for split view plus gap and padding
                      : documentState.pageWidth * documentState.scale + 80
                  )}px`,
                  minWidth: `${Math.max(
                    100,
                    viewState.currentView === "split"
                      ? documentState.pageWidth * documentState.scale * 2 + 100
                      : documentState.pageWidth * documentState.scale + 80
                  )}px`,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  paddingTop: "64px",
                  paddingBottom: "40px",
                  paddingLeft: "40px",
                  paddingRight: "40px",
                  margin: "0 auto",
                }}
              >
                <div
                  ref={documentRef}
                  className={`relative bg-white document-page ${
                    documentState.isScaleChanging ? "" : "zoom-transition"
                  } ${
                    editorState.isAddTextBoxMode ? "add-text-box-mode" : ""
                  } ${
                    editorState.isTextSelectionMode ? "text-selection-mode" : ""
                  } ${editorState.isSelectionMode ? "selection-mode" : ""} ${
                    editorState.isAddTextBoxMode ? "cursor-crosshair" : ""
                  } ${toolState.shapeDrawingMode ? "cursor-crosshair" : ""} ${
                    erasureState.isErasureMode ? "cursor-crosshair" : ""
                  } ${viewState.isCtrlPressed ? "cursor-zoom-in" : ""}`}
                  onClick={handleDocumentContainerClick}
                  onMouseDown={(e) => {
                    if (
                      editorState.isTextSelectionMode ||
                      erasureState.isErasureMode ||
                      editorState.isSelectionMode ||
                      editorState.multiSelection.isMovingSelection
                    ) {
                      if (editorState.multiSelection.isMovingSelection) {
                        handleMoveSelectionMouseDown(e);
                      } else if (editorState.isSelectionMode) {
                        handleMultiSelectionMouseDown(e);
                      } else {
                        handleDocumentMouseDown(e);
                      }
                    }
                  }}
                  onMouseMove={(e) => {
                    if (toolState.shapeDrawingMode) {
                      handleShapeDrawMove(e);
                    } else if (editorState.multiSelection.isMovingSelection) {
                      handleMoveSelectionMouseMove(e);
                    } else if (editorState.isTextSelectionMode) {
                      handleDocumentMouseMove(e);
                    } else if (editorState.isSelectionMode) {
                      handleMultiSelectionMouseMove(e);
                    } else if (erasureState.isErasureMode) {
                      handleErasureDrawMove(e);
                    }
                  }}
                  onMouseUp={(e) => {
                    if (toolState.shapeDrawingMode) {
                      handleShapeDrawEnd();
                    } else if (editorState.multiSelection.isMovingSelection) {
                      handleMoveSelectionMouseUp();
                    } else if (editorState.isTextSelectionMode) {
                      handleDocumentMouseUp(e);
                    } else if (editorState.isSelectionMode) {
                      handleMultiSelectionMouseUp(e);
                    } else if (erasureState.isErasureMode) {
                      handleErasureDrawEnd();
                    }
                  }}
                  style={{
                    width:
                      viewState.currentView === "split"
                        ? documentState.pageWidth * documentState.scale * 2 + 20 // Double width plus gap for split view
                        : documentState.pageWidth * documentState.scale,
                    height: documentState.pageHeight * documentState.scale,
                    minWidth:
                      viewState.currentView === "split"
                        ? documentState.pageWidth * documentState.scale * 2 + 20
                        : documentState.pageWidth * documentState.scale,
                    minHeight: documentState.pageHeight * documentState.scale,
                    display: "block",
                  }}
                >
                  {/* Document Rendering - Show different content based on view */}
                  {viewState.currentView === "original" && (
                    <DocumentPanel
                      viewType="original"
                      documentUrl={documentState.url}
                      currentPage={documentState.currentPage}
                      pageWidth={documentState.pageWidth}
                      pageHeight={documentState.pageHeight}
                      scale={documentState.scale}
                      numPages={documentState.numPages}
                      isScaleChanging={documentState.isScaleChanging}
                      isAddTextBoxMode={editorState.isAddTextBoxMode}
                      isTextSpanZooming={isTextSpanZooming}
                      isPdfFile={isPdfFile}
                      handlers={handlers}
                      actions={actions}
                      setDocumentState={setDocumentState}
                      deletionRectangles={
                        elementCollections.originalDeletionRectangles
                      }
                      showDeletionRectangles={
                        editorState.showDeletionRectangles
                      }
                      onDeleteDeletionRectangle={(id) =>
                        handleDeleteDeletionRectangleWithUndo(id, "original")
                      }
                      colorToRgba={colorToRgba}
                      sortedElements={getOriginalSortedElements(
                        documentState.currentPage
                      )}
                      getElementsInSelectionPreview={
                        getElementsInSelectionPreview
                      }
                      selectedFieldId={editorState.selectedFieldId}
                      selectedShapeId={editorState.selectedShapeId}
                      selectedElementId={selectedElementId}
                      isEditMode={editorState.isEditMode}
                      showPaddingIndicator={showPaddingPopup}
                      onTextBoxSelect={handleTextBoxSelect}
                      onShapeSelect={handleShapeSelect}
                      onImageSelect={handleImageSelect}
                      onUpdateTextBox={updateOriginalTextBoxWithUndo}
                      onUpdateShape={updateShapeWithUndo}
                      onUpdateImage={updateImage}
                      onDeleteTextBox={(id) =>
                        handleDeleteTextBoxWithUndo(id, "original")
                      }
                      onDeleteShape={(id) =>
                        handleDeleteShapeWithUndo(id, viewState.currentView)
                      }
                      onDeleteImage={(id) =>
                        handleDeleteImageWithUndo(id, viewState.currentView)
                      }
                      isTextSelectionMode={editorState.isTextSelectionMode}
                      selectedTextBoxes={selectionState.selectedTextBoxes}
                      autoFocusTextBoxId={autoFocusTextBoxId}
                      onAutoFocusComplete={handleAutoFocusComplete}
                      isSelectionMode={editorState.isSelectionMode}
                      multiSelection={editorState.multiSelection}
                      currentView={viewState.currentView}
                      onMoveSelection={handleMoveSelection}
                      onDeleteSelection={handleDeleteSelection}
                      onDragSelection={(deltaX, deltaY) => {
                        // Move all selected elements by delta (in real time)
                        moveSelectedElements(
                          editorState.multiSelection.selectedElements,
                          deltaX,
                          deltaY,
                          updateTextBoxWithUndo,
                          updateShape,
                          updateImage,
                          getElementById,
                          documentState.pageWidth,
                          documentState.pageHeight
                        );
                        // Update selection bounds in real time
                        setEditorState((prev) => {
                          const updatedElements =
                            prev.multiSelection.selectedElements.map((el) => ({
                              ...el,
                              originalPosition: {
                                x: el.originalPosition.x + deltaX,
                                y: el.originalPosition.y + deltaY,
                              },
                            }));
                          const newBounds = calculateSelectionBounds(
                            updatedElements,
                            getElementById
                          );
                          return {
                            ...prev,
                            multiSelection: {
                              ...prev.multiSelection,
                              selectedElements: updatedElements,
                              selectionBounds: newBounds,
                            },
                          };
                        });
                      }}
                      onDragStopSelection={handleDragStopSelection}
                    />
                  )}

                  {/* Translated Document View */}
                  {viewState.currentView === "translated" && (
                    <>
                      {/* Show translation table view when in translate workflow step */}
                      {viewState.currentWorkflowStep === "translate" ? (
                        <TranslationTableView
                          translatedTextBoxes={getCurrentTextBoxes(
                            "translated"
                          )}
                          untranslatedTexts={
                            elementCollections.untranslatedTexts
                          }
                          onUpdateTextBox={updateTranslatedTextBoxWithUndo}
                          onUpdateUntranslatedText={updateUntranslatedText}
                          onDeleteTextBox={
                            handleDeleteTextBoxAndUntranslatedText
                          }
                          onRowClick={handleTranslationRowClick}
                          onAddTextBox={handleAddCustomTextBox}
                          onAddUntranslatedText={
                            handleAddCustomUntranslatedText
                          }
                          pageWidth={documentState.pageWidth}
                          pageHeight={documentState.pageHeight}
                          scale={documentState.scale}
                          currentPage={documentState.currentPage}
                        />
                      ) : (
                        /* Show normal document layout when in layout workflow step */
                        <DocumentPanel
                          viewType="translated"
                          documentUrl={documentState.url}
                          currentPage={documentState.currentPage}
                          pageWidth={documentState.pageWidth}
                          pageHeight={documentState.pageHeight}
                          scale={documentState.scale}
                          numPages={documentState.numPages}
                          isScaleChanging={documentState.isScaleChanging}
                          isAddTextBoxMode={editorState.isAddTextBoxMode}
                          isTextSpanZooming={isTextSpanZooming}
                          isPdfFile={isPdfFile}
                          handlers={handlers}
                          actions={actions}
                          setDocumentState={setDocumentState}
                          isPageTranslated={
                            pageState.isPageTranslated.get(
                              documentState.currentPage
                            ) || false
                          }
                          isTransforming={pageState.isTransforming}
                          isTranslating={isTranslating}
                          onRunOcr={() =>
                            checkLanguageAndRunOcr(
                              "single",
                              documentState.currentPage
                            )
                          }
                          deletionRectangles={
                            elementCollections.translatedDeletionRectangles
                          }
                          showDeletionRectangles={
                            editorState.showDeletionRectangles
                          }
                          onDeleteDeletionRectangle={(id) =>
                            handleDeleteDeletionRectangleWithUndo(
                              id,
                              "translated"
                            )
                          }
                          colorToRgba={colorToRgba}
                          sortedElements={getTranslatedSortedElements(
                            documentState.currentPage
                          )}
                          getElementsInSelectionPreview={
                            getElementsInSelectionPreview
                          }
                          selectedFieldId={editorState.selectedFieldId}
                          selectedShapeId={editorState.selectedShapeId}
                          selectedElementId={selectedElementId}
                          isEditMode={editorState.isEditMode}
                          showPaddingIndicator={showPaddingPopup}
                          onTextBoxSelect={handleTextBoxSelect}
                          onShapeSelect={handleShapeSelect}
                          onImageSelect={handleImageSelect}
                          onUpdateTextBox={updateTranslatedTextBoxWithUndo}
                          onUpdateShape={updateShapeWithUndo}
                          onUpdateImage={updateImage}
                          onDeleteTextBox={(id) =>
                            handleDeleteTextBoxWithUndo(id, "translated")
                          }
                          onDeleteShape={(id) =>
                            handleDeleteShapeWithUndo(id, viewState.currentView)
                          }
                          onDeleteImage={(id) =>
                            handleDeleteImageWithUndo(id, viewState.currentView)
                          }
                          isTextSelectionMode={editorState.isTextSelectionMode}
                          selectedTextBoxes={selectionState.selectedTextBoxes}
                          autoFocusTextBoxId={autoFocusTextBoxId}
                          onAutoFocusComplete={handleAutoFocusComplete}
                          isSelectionMode={editorState.isSelectionMode}
                          multiSelection={editorState.multiSelection}
                          currentView={viewState.currentView}
                          onMoveSelection={handleMoveSelection}
                          onDeleteSelection={handleDeleteSelection}
                          onDragSelection={(deltaX, deltaY) => {
                            // Move all selected elements by delta (in real time)
                            moveSelectedElements(
                              editorState.multiSelection.selectedElements,
                              deltaX,
                              deltaY,
                              updateTextBoxWithUndo,
                              updateShape,
                              updateImage,
                              getElementById,
                              documentState.pageWidth,
                              documentState.pageHeight
                            );
                            // Update selection bounds in real time
                            setEditorState((prev) => {
                              const updatedElements =
                                prev.multiSelection.selectedElements.map(
                                  (el) => ({
                                    ...el,
                                    originalPosition: {
                                      x: el.originalPosition.x + deltaX,
                                      y: el.originalPosition.y + deltaY,
                                    },
                                  })
                                );
                              const newBounds = calculateSelectionBounds(
                                updatedElements,
                                getElementById
                              );
                              return {
                                ...prev,
                                multiSelection: {
                                  ...prev.multiSelection,
                                  selectedElements: updatedElements,
                                  selectionBounds: newBounds,
                                },
                              };
                            });
                          }}
                          onDragStopSelection={handleDragStopSelection}
                        />
                      )}
                    </>
                  )}

                  {/* Split Screen View */}
                  {viewState.currentView === "split" && (
                    <div
                      className="flex relative"
                      style={{
                        width:
                          documentState.pageWidth * documentState.scale * 2 +
                          20, // Double width plus gap
                        height: documentState.pageHeight * documentState.scale,
                      }}
                    >
                      {/* Original Document Side */}
                      <div style={{ position: "relative" }}>
                        <DocumentPanel
                          viewType="original"
                          documentUrl={documentState.url}
                          currentPage={documentState.currentPage}
                          pageWidth={documentState.pageWidth}
                          pageHeight={documentState.pageHeight}
                          scale={documentState.scale}
                          numPages={documentState.numPages}
                          isScaleChanging={documentState.isScaleChanging}
                          isAddTextBoxMode={editorState.isAddTextBoxMode}
                          isTextSpanZooming={isTextSpanZooming}
                          isPdfFile={isPdfFile}
                          handlers={handlers}
                          actions={actions}
                          setDocumentState={setDocumentState}
                          deletionRectangles={
                            elementCollections.originalDeletionRectangles
                          }
                          showDeletionRectangles={
                            editorState.showDeletionRectangles
                          }
                          onDeleteDeletionRectangle={(id) =>
                            handleDeleteDeletionRectangleWithUndo(
                              id,
                              "original"
                            )
                          }
                          colorToRgba={colorToRgba}
                          sortedElements={getOriginalSortedElements(
                            documentState.currentPage
                          )}
                          getElementsInSelectionPreview={
                            getElementsInSelectionPreview
                          }
                          selectedFieldId={editorState.selectedFieldId}
                          selectedShapeId={editorState.selectedShapeId}
                          selectedElementId={selectedElementId}
                          isEditMode={editorState.isEditMode}
                          showPaddingIndicator={showPaddingPopup}
                          onTextBoxSelect={handleTextBoxSelect}
                          onShapeSelect={handleShapeSelect}
                          onImageSelect={handleImageSelect}
                          onUpdateTextBox={updateOriginalTextBoxWithUndo}
                          onUpdateShape={updateShapeWithUndo}
                          onUpdateImage={updateImage}
                          onDeleteTextBox={(id) =>
                            handleDeleteTextBoxWithUndo(id, "original")
                          }
                          onDeleteShape={(id) =>
                            handleDeleteShapeWithUndo(id, viewState.currentView)
                          }
                          onDeleteImage={(id) =>
                            handleDeleteImageWithUndo(id, viewState.currentView)
                          }
                          isTextSelectionMode={editorState.isTextSelectionMode}
                          selectedTextBoxes={selectionState.selectedTextBoxes}
                          autoFocusTextBoxId={autoFocusTextBoxId}
                          onAutoFocusComplete={handleAutoFocusComplete}
                          isSelectionMode={editorState.isSelectionMode}
                          multiSelection={editorState.multiSelection}
                          currentView={viewState.currentView}
                          onMoveSelection={handleMoveSelection}
                          onDeleteSelection={handleDeleteSelection}
                          onDragSelection={(deltaX, deltaY) => {
                            moveSelectedElements(
                              editorState.multiSelection.selectedElements,
                              deltaX,
                              deltaY,
                              updateTextBoxWithUndo,
                              updateShape,
                              updateImage,
                              getElementById,
                              documentState.pageWidth,
                              documentState.pageHeight
                            );
                            setEditorState((prev) => {
                              const updatedElements =
                                prev.multiSelection.selectedElements.map(
                                  (el) => ({
                                    ...el,
                                    originalPosition: {
                                      x: el.originalPosition.x + deltaX,
                                      y: el.originalPosition.y + deltaY,
                                    },
                                  })
                                );
                              const newBounds = calculateSelectionBounds(
                                updatedElements,
                                getElementById
                              );
                              return {
                                ...prev,
                                multiSelection: {
                                  ...prev.multiSelection,
                                  selectedElements: updatedElements,
                                  selectionBounds: newBounds,
                                },
                              };
                            });
                          }}
                          onDragStopSelection={handleDragStopSelection}
                          header={
                            <div className="absolute -top-8 left-0 right-0 flex items-center justify-center">
                              <div className="bg-blue-500 text-white px-3 py-1 rounded-t-lg text-sm font-medium">
                                Original Document
                              </div>
                            </div>
                          }
                        />
                        {/* Interactive elements overlay for Original in Split View */}
                        <div
                          className="absolute top-0 left-0 interactive-elements-wrapper"
                          style={{
                            width:
                              documentState.pageWidth * documentState.scale,
                            height:
                              documentState.pageHeight * documentState.scale,
                            pointerEvents: "auto",
                            zIndex: 10000,
                          }}
                        >
                          {/* Deletion Rectangles */}
                          {getCurrentDeletionRectangles("original")
                            .filter(
                              (rect) => rect.page === documentState.currentPage
                            )
                            .map((rect) => (
                              <div
                                key={rect.id}
                                className={`absolute ${
                                  editorState.showDeletionRectangles
                                    ? "border border-red-400"
                                    : ""
                                }`}
                                style={{
                                  left: rect.x * documentState.scale,
                                  top: rect.y * documentState.scale,
                                  width: rect.width * documentState.scale,
                                  height: rect.height * documentState.scale,
                                  zIndex: editorState.showDeletionRectangles
                                    ? -10
                                    : -20,
                                  backgroundColor: rect.background
                                    ? colorToRgba(
                                        rect.background,
                                        rect.opacity || 1.0
                                      )
                                    : "white",
                                }}
                              >
                                {editorState.showDeletionRectangles && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteDeletionRectangleWithUndo(
                                        rect.id,
                                        "original"
                                      );
                                    }}
                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 text-xs shadow-md"
                                    title="Delete area"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}

                          {/* Untranslated text highlight overlay */}
                          <UntranslatedTextHighlight
                            untranslatedTexts={
                              elementCollections.untranslatedTexts
                            }
                            highlightedId={highlightedUntranslatedTextId}
                            currentPage={documentState.currentPage}
                            scale={documentState.scale}
                          />

                          {/* Render all elements in layer order */}
                          {getOriginalSortedElements(
                            documentState.currentPage
                          ).map((el) => renderElement(el, "original"))}
                          {/* Selection overlays for original view */}
                          {editorState.isSelectionMode &&
                            editorState.multiSelection.isDrawingSelection &&
                            editorState.multiSelection.selectionStart &&
                            editorState.multiSelection.selectionEnd &&
                            editorState.multiSelection.targetView ===
                              "original" && (
                              <SelectionPreview
                                start={
                                  editorState.multiSelection.selectionStart
                                }
                                end={editorState.multiSelection.selectionEnd}
                                scale={documentState.scale}
                              />
                            )}
                          {editorState.isSelectionMode &&
                            editorState.multiSelection.selectionBounds &&
                            editorState.multiSelection.selectedElements.length >
                              0 &&
                            editorState.multiSelection.targetView ===
                              "original" && (
                              <SelectionRectangle
                                bounds={
                                  editorState.multiSelection.selectionBounds
                                }
                                scale={documentState.scale}
                                onMove={handleMoveSelection}
                                onDelete={handleDeleteSelection}
                                isMoving={
                                  editorState.multiSelection.isMovingSelection
                                }
                                onDragSelection={(deltaX, deltaY) => {
                                  moveSelectedElements(
                                    editorState.multiSelection.selectedElements,
                                    deltaX,
                                    deltaY,
                                    (id, updates) =>
                                      updateTextBoxWithUndo(id, updates, true),
                                    (id, updates) =>
                                      updateShapeWithUndo(id, updates, true),
                                    updateImage,
                                    getElementById,
                                    documentState.pageWidth,
                                    documentState.pageHeight
                                  );
                                  setEditorState((prev) => {
                                    const updatedElements =
                                      prev.multiSelection.selectedElements.map(
                                        (el) => ({
                                          ...el,
                                          originalPosition: {
                                            x: el.originalPosition.x + deltaX,
                                            y: el.originalPosition.y + deltaY,
                                          },
                                        })
                                      );
                                    const newBounds = calculateSelectionBounds(
                                      updatedElements,
                                      getElementById
                                    );
                                    return {
                                      ...prev,
                                      multiSelection: {
                                        ...prev.multiSelection,
                                        selectedElements: updatedElements,
                                        selectionBounds: newBounds,
                                      },
                                    };
                                  });
                                }}
                                onDragStopSelection={handleDragStopSelection}
                              />
                            )}
                        </div>
                      </div>

                      {/* Gap between documents */}
                      <div className="w-5 flex items-center justify-center">
                        <div className="w-px h-full bg-gray-300"></div>
                      </div>

                      {/* Translated Document Side */}
                      <div style={{ position: "relative" }}>
                        {/* Show translation table view when in translate workflow step */}
                        {viewState.currentWorkflowStep === "translate" ? (
                          <TranslationTableView
                            translatedTextBoxes={getCurrentTextBoxes(
                              "translated"
                            )}
                            untranslatedTexts={
                              elementCollections.untranslatedTexts
                            }
                            onUpdateTextBox={updateTranslatedTextBoxWithUndo}
                            onUpdateUntranslatedText={updateUntranslatedText}
                            onDeleteTextBox={
                              handleDeleteTextBoxAndUntranslatedText
                            }
                            onRowClick={handleTranslationRowClick}
                            onAddTextBox={handleAddCustomTextBox}
                            onAddUntranslatedText={
                              handleAddCustomUntranslatedText
                            }
                            pageWidth={documentState.pageWidth}
                            pageHeight={documentState.pageHeight}
                            scale={documentState.scale}
                            currentPage={documentState.currentPage}
                          />
                        ) : (
                          /* Show normal document layout when in layout workflow step */
                          <DocumentPanel
                            viewType="translated"
                            documentUrl={documentState.url}
                            currentPage={documentState.currentPage}
                            pageWidth={documentState.pageWidth}
                            pageHeight={documentState.pageHeight}
                            scale={documentState.scale}
                            numPages={documentState.numPages}
                            isScaleChanging={documentState.isScaleChanging}
                            isAddTextBoxMode={editorState.isAddTextBoxMode}
                            isTextSpanZooming={isTextSpanZooming}
                            isPdfFile={isPdfFile}
                            handlers={handlers}
                            actions={actions}
                            setDocumentState={setDocumentState}
                            isPageTranslated={
                              pageState.isPageTranslated.get(
                                documentState.currentPage
                              ) || false
                            }
                            isTransforming={pageState.isTransforming}
                            isTranslating={isTranslating}
                            onRunOcr={() =>
                              checkLanguageAndRunOcr(
                                "single",
                                documentState.currentPage
                              )
                            }
                            deletionRectangles={
                              elementCollections.translatedDeletionRectangles
                            }
                            showDeletionRectangles={
                              editorState.showDeletionRectangles
                            }
                            onDeleteDeletionRectangle={(id) =>
                              handleDeleteDeletionRectangleWithUndo(
                                id,
                                "translated"
                              )
                            }
                            colorToRgba={colorToRgba}
                            sortedElements={getTranslatedSortedElements(
                              documentState.currentPage
                            )}
                            getElementsInSelectionPreview={
                              getElementsInSelectionPreview
                            }
                            selectedFieldId={editorState.selectedFieldId}
                            selectedShapeId={editorState.selectedShapeId}
                            selectedElementId={selectedElementId}
                            isEditMode={editorState.isEditMode}
                            showPaddingIndicator={showPaddingPopup}
                            onTextBoxSelect={handleTextBoxSelect}
                            onShapeSelect={handleShapeSelect}
                            onImageSelect={handleImageSelect}
                            onUpdateTextBox={updateTranslatedTextBoxWithUndo}
                            onUpdateShape={updateShapeWithUndo}
                            onUpdateImage={updateImage}
                            onDeleteTextBox={(id) =>
                              handleDeleteTextBoxWithUndo(id, "translated")
                            }
                            onDeleteShape={(id) =>
                              handleDeleteShapeWithUndo(
                                id,
                                viewState.currentView
                              )
                            }
                            onDeleteImage={(id) =>
                              handleDeleteImageWithUndo(
                                id,
                                viewState.currentView
                              )
                            }
                            isTextSelectionMode={
                              editorState.isTextSelectionMode
                            }
                            selectedTextBoxes={selectionState.selectedTextBoxes}
                            autoFocusTextBoxId={autoFocusTextBoxId}
                            onAutoFocusComplete={handleAutoFocusComplete}
                            isSelectionMode={editorState.isSelectionMode}
                            multiSelection={editorState.multiSelection}
                            currentView={viewState.currentView}
                            onMoveSelection={handleMoveSelection}
                            onDeleteSelection={handleDeleteSelection}
                            onDragSelection={(deltaX, deltaY) => {
                              moveSelectedElements(
                                editorState.multiSelection.selectedElements,
                                deltaX,
                                deltaY,
                                updateTextBoxWithUndo,
                                updateShape,
                                updateImage,
                                getElementById,
                                documentState.pageWidth,
                                documentState.pageHeight
                              );
                              setEditorState((prev) => {
                                const updatedElements =
                                  prev.multiSelection.selectedElements.map(
                                    (el) => ({
                                      ...el,
                                      originalPosition: {
                                        x: el.originalPosition.x + deltaX,
                                        y: el.originalPosition.y + deltaY,
                                      },
                                    })
                                  );
                                const newBounds = calculateSelectionBounds(
                                  updatedElements,
                                  getElementById
                                );
                                return {
                                  ...prev,
                                  multiSelection: {
                                    ...prev.multiSelection,
                                    selectedElements: updatedElements,
                                    selectionBounds: newBounds,
                                  },
                                };
                              });
                            }}
                            onDragStopSelection={handleDragStopSelection}
                            header={
                              <div className="absolute -top-8 left-0 right-0 flex items-center justify-center">
                                <div className="bg-green-500 text-white px-3 py-1 rounded-t-lg text-sm font-medium">
                                  Translated Document
                                </div>
                              </div>
                            }
                          />
                        )}
                        {/* Interactive elements overlay for Translated in Split View - only show in layout mode */}
                        {viewState.currentWorkflowStep !== "translate" && (
                          <div
                            className="absolute top-0 left-0 interactive-elements-wrapper"
                            style={{
                              width:
                                documentState.pageWidth * documentState.scale,
                              height:
                                documentState.pageHeight * documentState.scale,
                              pointerEvents: "auto",
                              zIndex: 10000,
                            }}
                          >
                            {/* Deletion Rectangles */}
                            {getCurrentDeletionRectangles("translated")
                              .filter(
                                (rect) =>
                                  rect.page === documentState.currentPage
                              )
                              .map((rect) => (
                                <div
                                  key={rect.id}
                                  className={`absolute ${
                                    editorState.showDeletionRectangles
                                      ? "border border-red-400"
                                      : ""
                                  }`}
                                  style={{
                                    left: rect.x * documentState.scale,
                                    top: rect.y * documentState.scale,
                                    width: rect.width * documentState.scale,
                                    height: rect.height * documentState.scale,
                                    zIndex: editorState.showDeletionRectangles
                                      ? -10
                                      : -20,
                                    backgroundColor: rect.background
                                      ? colorToRgba(
                                          rect.background,
                                          rect.opacity || 1.0
                                        )
                                      : "white",
                                  }}
                                >
                                  {editorState.showDeletionRectangles && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteDeletionRectangleWithUndo(
                                          rect.id,
                                          "translated"
                                        );
                                      }}
                                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 text-xs shadow-md"
                                      title="Delete area"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                            {/* Render all elements in layer order */}
                            {getTranslatedSortedElements(
                              documentState.currentPage
                            ).map((el) => renderElement(el, "translated"))}
                            {/* Selection overlays for translated view */}
                            {editorState.isSelectionMode &&
                              editorState.multiSelection.isDrawingSelection &&
                              editorState.multiSelection.selectionStart &&
                              editorState.multiSelection.selectionEnd &&
                              editorState.multiSelection.targetView ===
                                "translated" && (
                                <SelectionPreview
                                  start={
                                    editorState.multiSelection.selectionStart
                                  }
                                  end={editorState.multiSelection.selectionEnd}
                                  scale={documentState.scale}
                                />
                              )}
                            {editorState.isSelectionMode &&
                              editorState.multiSelection.selectionBounds &&
                              editorState.multiSelection.selectedElements
                                .length > 0 &&
                              editorState.multiSelection.targetView ===
                                "translated" && (
                                <SelectionRectangle
                                  bounds={
                                    editorState.multiSelection.selectionBounds
                                  }
                                  scale={documentState.scale}
                                  onMove={handleMoveSelection}
                                  onDelete={handleDeleteSelection}
                                  isMoving={
                                    editorState.multiSelection.isMovingSelection
                                  }
                                  onDragSelection={(deltaX, deltaY) => {
                                    moveSelectedElements(
                                      editorState.multiSelection
                                        .selectedElements,
                                      deltaX,
                                      deltaY,
                                      (id, updates) =>
                                        updateTextBoxWithUndo(
                                          id,
                                          updates,
                                          true
                                        ),
                                      (id, updates) =>
                                        updateShapeWithUndo(id, updates, true),
                                      updateImage,
                                      getElementById,
                                      documentState.pageWidth,
                                      documentState.pageHeight
                                    );
                                    setEditorState((prev) => {
                                      const updatedElements =
                                        prev.multiSelection.selectedElements.map(
                                          (el) => ({
                                            ...el,
                                            originalPosition: {
                                              x: el.originalPosition.x + deltaX,
                                              y: el.originalPosition.y + deltaY,
                                            },
                                          })
                                        );
                                      const newBounds =
                                        calculateSelectionBounds(
                                          updatedElements,
                                          getElementById
                                        );
                                      return {
                                        ...prev,
                                        multiSelection: {
                                          ...prev.multiSelection,
                                          selectedElements: updatedElements,
                                          selectionBounds: newBounds,
                                        },
                                      };
                                    });
                                  }}
                                  onDragStopSelection={handleDragStopSelection}
                                />
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Show interactive elements in both original and translated views */}
                  {(viewState.currentView === "original" ||
                    (viewState.currentView === "translated" &&
                      viewState.currentWorkflowStep !== "translate")) && (
                    <div
                      className="absolute inset-0 interactive-elements-wrapper"
                      style={{
                        zIndex:
                          editorState.isTextSelectionMode ||
                          editorState.isAddTextBoxMode
                            ? 100
                            : 10000,
                        pointerEvents:
                          editorState.isTextSelectionMode ||
                          editorState.isAddTextBoxMode
                            ? "none"
                            : "auto",
                      }}
                    >
                      {/* Deletion Rectangles */}
                      {currentPageDeletionRectangles.map((rect) => (
                        <div
                          key={rect.id}
                          className={`absolute ${
                            editorState.showDeletionRectangles
                              ? "border border-red-400"
                              : ""
                          }`}
                          style={{
                            left: rect.x * documentState.scale,
                            top: rect.y * documentState.scale,
                            width: rect.width * documentState.scale,
                            height: rect.height * documentState.scale,
                            zIndex: editorState.showDeletionRectangles
                              ? -10
                              : -20,
                            backgroundColor: rect.background
                              ? colorToRgba(
                                  rect.background,
                                  rect.opacity || 1.0
                                )
                              : "white",
                          }}
                        >
                          {editorState.showDeletionRectangles && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDeletionRectangleWithUndo(
                                  rect.id,
                                  viewState.currentView
                                );
                              }}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 text-xs shadow-md"
                              title="Delete area"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Render all elements in layer order */}
                      {currentPageSortedElements.map((el) =>
                        renderElement(el, viewState.currentView)
                      )}

                      {/* Single View Selection Components */}
                      {editorState.isSelectionMode && (
                        <>
                          {/* Selection Preview for Single Views */}
                          {editorState.multiSelection.isDrawingSelection &&
                            editorState.multiSelection.selectionStart &&
                            editorState.multiSelection.selectionEnd &&
                            ((viewState.currentView === "original" &&
                              editorState.multiSelection.targetView ===
                                "original") ||
                              (viewState.currentView === "translated" &&
                                editorState.multiSelection.targetView ===
                                  "translated")) && (
                              <SelectionPreview
                                start={
                                  editorState.multiSelection.selectionStart
                                }
                                end={editorState.multiSelection.selectionEnd}
                                scale={documentState.scale}
                              />
                            )}

                          {/* Selection Rectangle for Single Views */}
                          {editorState.multiSelection.selectionBounds &&
                            editorState.multiSelection.selectedElements.length >
                              0 &&
                            ((viewState.currentView === "original" &&
                              editorState.multiSelection.targetView ===
                                "original") ||
                              (viewState.currentView === "translated" &&
                                editorState.multiSelection.targetView ===
                                  "translated")) && (
                              <SelectionRectangle
                                bounds={
                                  editorState.multiSelection.selectionBounds
                                }
                                scale={documentState.scale}
                                onMove={handleMoveSelection}
                                onDelete={handleDeleteSelection}
                                isMoving={
                                  editorState.multiSelection.isMovingSelection
                                }
                                onDragSelection={(deltaX, deltaY) => {
                                  // Move all selected elements by delta (in real time)
                                  moveSelectedElements(
                                    editorState.multiSelection.selectedElements,
                                    deltaX,
                                    deltaY,
                                    (id, updates) =>
                                      updateTextBoxWithUndo(id, updates, true), // Mark as ongoing operation
                                    (id, updates) =>
                                      updateShapeWithUndo(id, updates, true), // Mark as ongoing operation
                                    updateImage,
                                    getElementById,
                                    documentState.pageWidth,
                                    documentState.pageHeight
                                  );
                                  // Update selection bounds in real time
                                  setEditorState((prev) => {
                                    const updatedElements =
                                      prev.multiSelection.selectedElements.map(
                                        (el) => ({
                                          ...el,
                                          originalPosition: {
                                            x: el.originalPosition.x + deltaX,
                                            y: el.originalPosition.y + deltaY,
                                          },
                                        })
                                      );
                                    const newBounds = calculateSelectionBounds(
                                      updatedElements,
                                      getElementById
                                    );
                                    return {
                                      ...prev,
                                      multiSelection: {
                                        ...prev.multiSelection,
                                        selectedElements: updatedElements,
                                        selectionBounds: newBounds,
                                      },
                                    };
                                  });
                                }}
                                onDragStopSelection={handleDragStopSelection}
                              />
                            )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Shape Drawing Preview */}
                  {toolState.isDrawingInProgress &&
                    toolState.shapeDrawStart &&
                    toolState.shapeDrawEnd && (
                      <>
                        {toolState.shapeDrawingMode === "line" ? (
                          // Line preview using SVG
                          <svg
                            className="absolute pointer-events-none"
                            style={{
                              left: getPreviewLeft(
                                Math.min(
                                  toolState.shapeDrawStart.x,
                                  toolState.shapeDrawEnd.x
                                ) - 10,
                                viewState.currentView === "split"
                                  ? toolState.shapeDrawTargetView === "translated"
                                  : viewState.currentView === "translated",
                                viewState.currentView,
                                documentState.pageWidth,
                                documentState.scale
                              ),
                              top: (Math.min(
                                toolState.shapeDrawStart.y,
                                toolState.shapeDrawEnd.y
                              ) - 10) * documentState.scale,
                              width: (Math.abs(
                                toolState.shapeDrawEnd.x -
                                  toolState.shapeDrawStart.x
                              ) + 20) * documentState.scale,
                              height: (Math.abs(
                                toolState.shapeDrawEnd.y -
                                  toolState.shapeDrawStart.y
                              ) + 20) * documentState.scale,
                              zIndex: 50,
                            }}
                          >
                            <line
                              x1={(toolState.shapeDrawStart.x - Math.min(
                                toolState.shapeDrawStart.x,
                                toolState.shapeDrawEnd.x
                              ) + 10) * documentState.scale}
                              y1={(toolState.shapeDrawStart.y - Math.min(
                                toolState.shapeDrawStart.y,
                                toolState.shapeDrawEnd.y
                              ) + 10) * documentState.scale}
                              x2={(toolState.shapeDrawEnd.x - Math.min(
                                toolState.shapeDrawStart.x,
                                toolState.shapeDrawEnd.x
                              ) + 10) * documentState.scale}
                              y2={(toolState.shapeDrawEnd.y - Math.min(
                                toolState.shapeDrawStart.y,
                                toolState.shapeDrawEnd.y
                              ) + 10) * documentState.scale}
                              stroke="#ef4444"
                              strokeWidth="2"
                              strokeDasharray="5,5"
                              strokeLinecap="round"
                            />
                            {/* Preview anchor points */}
                            <circle
                              cx={(toolState.shapeDrawStart.x - Math.min(
                                toolState.shapeDrawStart.x,
                                toolState.shapeDrawEnd.x
                              ) + 10) * documentState.scale}
                              cy={(toolState.shapeDrawStart.y - Math.min(
                                toolState.shapeDrawStart.y,
                                toolState.shapeDrawEnd.y
                              ) + 10) * documentState.scale}
                              r="4"
                              fill="#3b82f6"
                              stroke="white"
                              strokeWidth="1"
                            />
                            <circle
                              cx={(toolState.shapeDrawEnd.x - Math.min(
                                toolState.shapeDrawStart.x,
                                toolState.shapeDrawEnd.x
                              ) + 10) * documentState.scale}
                              cy={(toolState.shapeDrawEnd.y - Math.min(
                                toolState.shapeDrawStart.y,
                                toolState.shapeDrawEnd.y
                              ) + 10) * documentState.scale}
                              r="4"
                              fill="#3b82f6"
                              stroke="white"
                              strokeWidth="1"
                            />
                          </svg>
                        ) : (
                          // Rectangle/Circle preview using bounding box
                          <div
                            className="absolute border-2 border-dashed border-red-500 bg-red-100 bg-opacity-30 pointer-events-none"
                            style={{
                              left: getPreviewLeft(
                                Math.min(
                                  toolState.shapeDrawStart.x,
                                  toolState.shapeDrawEnd.x
                                ),
                                viewState.currentView === "split"
                                  ? toolState.shapeDrawTargetView === "translated"
                                  : viewState.currentView === "translated",
                                viewState.currentView,
                                documentState.pageWidth,
                                documentState.scale
                              ),
                              top:
                                Math.min(
                                  toolState.shapeDrawStart.y,
                                  toolState.shapeDrawEnd.y
                                ) * documentState.scale,
                              width:
                                Math.abs(
                                  toolState.shapeDrawEnd.x -
                                    toolState.shapeDrawStart.x
                                ) * documentState.scale,
                              height:
                                Math.abs(
                                  toolState.shapeDrawEnd.y -
                                    toolState.shapeDrawStart.y
                                ) * documentState.scale,
                              borderRadius:
                                toolState.shapeDrawingMode === "circle"
                                  ? "50%"
                                  : "0",
                              zIndex: 50,
                            }}
                          />
                        )}
                      </>
                    )}

                  {/* Erasure Drawing Preview */}
                  {erasureState.isDrawingErasure &&
                    erasureState.erasureDrawStart &&
                    erasureState.erasureDrawEnd && (
                      <div
                        className="absolute border-2 border-dashed pointer-events-none"
                        style={{
                          left: getPreviewLeft(
                            Math.min(
                              erasureState.erasureDrawStart.x,
                              erasureState.erasureDrawEnd.x
                            ),
                            viewState.currentView === "split"
                              ? erasureState.erasureDrawTargetView ===
                                  "translated"
                              : viewState.currentView === "translated",
                            viewState.currentView,
                            documentState.pageWidth,
                            documentState.scale
                          ),
                          top:
                            Math.min(
                              erasureState.erasureDrawStart.y,
                              erasureState.erasureDrawEnd.y
                            ) * documentState.scale,
                          width:
                            Math.abs(
                              erasureState.erasureDrawEnd.x -
                                erasureState.erasureDrawStart.x
                            ) * documentState.scale,
                          height:
                            Math.abs(
                              erasureState.erasureDrawEnd.y -
                                erasureState.erasureDrawStart.y
                            ) * documentState.scale,
                          backgroundColor: colorToRgba(
                            documentState.pdfBackgroundColor,
                            erasureState.erasureSettings.opacity
                          ),
                          zIndex: 50,
                        }}
                      />
                    )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  )
}

export default MainContent

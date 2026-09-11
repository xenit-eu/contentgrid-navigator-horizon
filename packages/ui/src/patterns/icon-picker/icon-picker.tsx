import { useState } from "react";
import {
  AddressBookIcon as AddressBook,
  ArchiveIcon as Archive,
  ArticleIcon as Article,
  BasketIcon as Basket,
  BlueprintIcon as Blueprint,
  BookIcon as Book,
  BriefcaseIcon as Briefcase,
  BuildingsIcon as Buildings,
  CalendarCheckIcon as CalendarCheck,
  CalendarDotsIcon as CalendarDots,
  CameraIcon as Camera,
  CarProfileIcon as CarProfile,
  ChalkboardTeacherIcon as ChalkboardTeacher,
  ChatCircleTextIcon as ChatCircleText,
  CheckSquareIcon as CheckSquare,
  CheckSquareOffsetIcon as CheckSquareOffset,
  ClockUserIcon as ClockUser,
  CodeSimpleIcon as CodeSimple,
  CubeIcon as Cube,
  CurrencyDollarSimpleIcon as CurrencyDollarSimple,
  CurrencyEurIcon as CurrencyEur,
  CylinderIcon as Cylinder,
  DatabaseIcon as Database,
  DevicesIcon as Devices,
  FileIcon as File,
  FileArchiveIcon as FileArchive,
  FileAudioIcon as FileAudio,
  FileCloudIcon as FileCloud,
  FileCodeIcon as FileCode,
  FileCsvIcon as FileCsv,
  FileImageIcon as FileImage,
  FileJpgIcon as FileJpg,
  FileMdIcon as FileMd,
  FilePptIcon as FilePpt,
  FileTextIcon as FileText,
  FileVideoIcon as FileVideo,
  FilesIcon as Files,
  FloppyDiskIcon as FloppyDisk,
  FolderIcon as Folder,
  FolderOpenIcon as FolderOpen,
  FolderSimpleDashedIcon as FolderSimpleDashed,
  FoldersIcon as Folders,
  GraphIcon as Graph,
  HashStraightIcon as HashStraight,
  HouseLineIcon as HouseLine,
  type Icon,
  IdentificationCardIcon as IdentificationCard,
  ImageIcon as Image,
  ImagesIcon as Images,
  InvoiceIcon as Invoice,
  LaptopIcon as Laptop,
  LinkSimpleIcon as LinkSimple,
  MailboxIcon as Mailbox,
  MoneyIcon as Money,
  MonitorIcon as Monitor,
  NoteIcon as Note,
  PasswordIcon as Password,
  PencilLineIcon as PencilLine,
  PolygonIcon as Polygon,
  PresentationIcon as Presentation,
  PresentationChartIcon as PresentationChart,
  QuestionIcon as Question,
  ReceiptIcon as Receipt,
  ScrollIcon as Scroll,
  SignatureIcon as Signature,
  StickerIcon as Sticker,
  TicketIcon as Ticket,
  UserListIcon as UserList,
  UserSquareIcon as UserSquare,
  UsersIcon as Users,
  WaveformIcon as Waveform,
} from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";
import { Input } from "../../primitives/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/popover";
import { SelectionChip } from "../../primitives/selection-chip";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const ICON_CATEGORIES = [
  "Files",
  "Persons",
  "Shapes",
  "Business",
  "Calendar",
  "Other",
] as const;

export type IconCategory = (typeof ICON_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Curated icon set
// ---------------------------------------------------------------------------

export interface IconOption {
  readonly name: string;
  readonly Icon: Icon;
  /** One or more categories this icon belongs to — drives the picker's category filter. */
  readonly categories: readonly IconCategory[];
}

/**
 * Curated Phosphor icons suitable for representing an entity type, tagged by category for
 * the picker's category filter. `name` is the value stored in
 * `EntityDisplayPreferences.icon` — keep these names stable, since existing user overrides
 * reference them by string.
 */
export const ENTITY_ICON_OPTIONS: readonly IconOption[] = [
  { name: "AddressBook", Icon: AddressBook, categories: ["Persons"] },
  { name: "Archive", Icon: Archive, categories: ["Files"] },
  { name: "Article", Icon: Article, categories: ["Files"] },
  { name: "Basket", Icon: Basket, categories: ["Business"] },
  { name: "Blueprint", Icon: Blueprint, categories: ["Shapes"] },
  { name: "Book", Icon: Book, categories: ["Other"] },
  { name: "Briefcase", Icon: Briefcase, categories: ["Business"] },
  { name: "Buildings", Icon: Buildings, categories: ["Business"] },
  { name: "CalendarCheck", Icon: CalendarCheck, categories: ["Calendar"] },
  { name: "CalendarDots", Icon: CalendarDots, categories: ["Calendar"] },
  { name: "Camera", Icon: Camera, categories: ["Files"] },
  { name: "CarProfile", Icon: CarProfile, categories: ["Business"] },
  { name: "ChalkboardTeacher", Icon: ChalkboardTeacher, categories: ["Business", "Persons"] },
  { name: "ChatCircleText", Icon: ChatCircleText, categories: ["Other"] },
  { name: "CheckSquare", Icon: CheckSquare, categories: ["Shapes"] },
  { name: "CheckSquareOffset", Icon: CheckSquareOffset, categories: ["Shapes"] },
  { name: "ClockUser", Icon: ClockUser, categories: ["Calendar", "Persons"] },
  { name: "CodeSimple", Icon: CodeSimple, categories: ["Business"] },
  { name: "Cube", Icon: Cube, categories: ["Shapes"] },
  { name: "CurrencyDollarSimple", Icon: CurrencyDollarSimple, categories: ["Business"] },
  { name: "CurrencyEur", Icon: CurrencyEur, categories: ["Business"] },
  { name: "Cylinder", Icon: Cylinder, categories: ["Shapes"] },
  { name: "Database", Icon: Database, categories: ["Business", "Files"] },
  { name: "Devices", Icon: Devices, categories: ["Business"] },
  { name: "File", Icon: File, categories: ["Files"] },
  { name: "FileArchive", Icon: FileArchive, categories: ["Files"] },
  { name: "FileAudio", Icon: FileAudio, categories: ["Files"] },
  { name: "FileCloud", Icon: FileCloud, categories: ["Files", "Business"] },
  { name: "FileCode", Icon: FileCode, categories: ["Files", "Business"] },
  { name: "FileCsv", Icon: FileCsv, categories: ["Files"] },
  { name: "FileImage", Icon: FileImage, categories: ["Files"] },
  { name: "FileJpg", Icon: FileJpg, categories: ["Files"] },
  { name: "FileMd", Icon: FileMd, categories: ["Files"] },
  { name: "FilePpt", Icon: FilePpt, categories: ["Files", "Business"] },
  { name: "FileText", Icon: FileText, categories: ["Files"] },
  { name: "FileVideo", Icon: FileVideo, categories: ["Files"] },
  { name: "Files", Icon: Files, categories: ["Files"] },
  { name: "FloppyDisk", Icon: FloppyDisk, categories: ["Business", "Files"] },
  { name: "Folder", Icon: Folder, categories: ["Files"] },
  { name: "FolderOpen", Icon: FolderOpen, categories: ["Files"] },
  { name: "FolderSimpleDashed", Icon: FolderSimpleDashed, categories: ["Files"] },
  { name: "Folders", Icon: Folders, categories: ["Files"] },
  { name: "Graph", Icon: Graph, categories: ["Shapes", "Business"] },
  { name: "HashStraight", Icon: HashStraight, categories: ["Shapes"] },
  { name: "HouseLine", Icon: HouseLine, categories: ["Business"] },
  { name: "IdentificationCard", Icon: IdentificationCard, categories: ["Persons"] },
  { name: "Image", Icon: Image, categories: ["Files"] },
  { name: "Images", Icon: Images, categories: ["Files"] },
  { name: "Invoice", Icon: Invoice, categories: ["Business"] },
  { name: "Laptop", Icon: Laptop, categories: ["Business"] },
  { name: "LinkSimple", Icon: LinkSimple, categories: ["Business"] },
  { name: "Mailbox", Icon: Mailbox, categories: ["Other"] },
  { name: "Money", Icon: Money, categories: ["Business"] },
  { name: "Monitor", Icon: Monitor, categories: ["Business"] },
  { name: "Note", Icon: Note, categories: ["Other"] },
  { name: "Password", Icon: Password, categories: ["Business"] },
  { name: "PencilLine", Icon: PencilLine, categories: ["Other"] },
  { name: "Polygon", Icon: Polygon, categories: ["Shapes"] },
  { name: "PresentationChart", Icon: PresentationChart, categories: ["Business"] },
  { name: "Presentation", Icon: Presentation, categories: ["Business"] },
  { name: "Receipt", Icon: Receipt, categories: ["Business"] },
  { name: "Scroll", Icon: Scroll, categories: ["Other"] },
  { name: "Signature", Icon: Signature, categories: ["Persons"] },
  { name: "Sticker", Icon: Sticker, categories: ["Other"] },
  { name: "Ticket", Icon: Ticket, categories: ["Business"] },
  { name: "UserList", Icon: UserList, categories: ["Persons"] },
  { name: "Users", Icon: Users, categories: ["Persons"] },
  { name: "UserSquare", Icon: UserSquare, categories: ["Persons", "Shapes"] },
  { name: "Waveform", Icon: Waveform, categories: ["Files"] },
];

/** Resolve a stored icon name (`EntityDisplayPreferences.icon`) back to its component. */
export function resolveEntityIcon(name: string | undefined): Icon | undefined {
  return ENTITY_ICON_OPTIONS.find((option) => option.name === name)?.Icon;
}

// ---------------------------------------------------------------------------
// IconPicker
// ---------------------------------------------------------------------------

export interface IconPickerContentProps {
  /** Currently selected icon name (one of `ENTITY_ICON_OPTIONS`), or `undefined` if unset. */
  readonly value: string | undefined;
  /** Called with the selected icon's `name` when the user picks one. */
  readonly onChange: (name: string) => void;
  readonly className?: string;
}

/**
 * The icon search/category-filter/grid UI, with no popover chrome of its own — drop it
 * into any `PopoverContent` (or compose it alongside other pickers, e.g. `IconColorPicker`).
 */
export function IconPickerContent({
  value,
  onChange,
  className,
}: Readonly<IconPickerContentProps>) {
  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<readonly IconCategory[]>([]);

  function toggleCategory(category: IconCategory) {
    setSelectedCategories((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category],
    );
  }

  // Category filter is a union (OR) across selected categories, narrowed further by search text.
  const filtered = ENTITY_ICON_OPTIONS.filter((option) => {
    const matchesQuery = option.name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory =
      selectedCategories.length === 0 ||
      option.categories.some((category) => selectedCategories.includes(category));
    return matchesQuery && matchesCategory;
  });

  return (
    <div className={className}>
      <Input
        name="icon-search"
        placeholder="Search icons…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mb-2"
      />
      <div className="mb-2 flex flex-wrap gap-1.5">
        {ICON_CATEGORIES.map((category) => (
          <SelectionChip
            key={category}
            label={category}
            selected={selectedCategories.includes(category)}
            onClick={() => toggleCategory(category)}
          />
        ))}
      </div>
      <div className="grid max-h-56 grid-cols-7 gap-1 overflow-y-auto">
        {filtered.map(({ name, Icon: OptionIcon }) => (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={value === name}
            onClick={() => onChange(name)}
            className={cn(
              "flex items-center justify-center rounded-md border p-2 hover:bg-accent",
              value === name ? "border-primary bg-accent" : "border-transparent",
            )}
          >
            <OptionIcon className="size-4" aria-hidden />
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-7 py-2 text-center text-sm text-muted-foreground">
            No icons found
          </p>
        )}
      </div>
    </div>
  );
}

export interface IconPickerProps {
  /** Currently selected icon name (one of `ENTITY_ICON_OPTIONS`), or `undefined` if unset. */
  readonly value: string | undefined;
  /** Called with the selected icon's `name` when the user picks one. */
  readonly onChange: (name: string) => void;
  readonly className?: string;
}

export function IconPicker({ value, onChange, className }: Readonly<IconPickerProps>) {
  const SelectedIcon = resolveEntityIcon(value) ?? Question;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("justify-start gap-2", className)}>
          <SelectedIcon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{value ?? "Choose icon"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <IconPickerContent value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { ChangeFeedIterator, Container, CosmosClient, FeedOptions, ItemDefinition, SqlQuerySpec } from '@azure/cosmos';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'cosmosDB';

  private endpoint = '';
  private key = '';
  private client!: CosmosClient;

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    this.cosmosClientInit();

    const databaseId = 'newDatabase';
    const containerId = 'newContainer';
    const container: Container = this.client.database(databaseId).container(containerId);
  }

  cosmosClientInit() {
    this.client = new CosmosClient({ endpoint: this.endpoint, key: this.key });
  }

  /**
   *
   * @param databaseId
   * @param containerId
   *
   * 新建database、container、item範例
   */
  async createDatabaseAndContainer(databaseId: string, containerId: string) {
    const { database } = await this.client.databases.create({ id: databaseId });
    const { container } = await database.containers.create({ id: containerId });
    // const { database } = await this.client.databases.createIfNotExists({ id: databaseId });
    // const { container } = await database.containers.createIfNotExists({ id: containerId });
    const newItem = { id: '2', name: 'test' };
    const { resource } = await container.items.create(newItem);

    if (resource) {
      console.log(`Created item: ${resource.id}`);
    }
  }

  /**
   * 檢查container是否存在
   */
  async checkContainerExists(databaseId: string, containerId: string): Promise<boolean> {
    try {
      await this.client.database(databaseId).container(containerId).read();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getContainer(databaseId: string, containerId: string): Promise<Container | undefined> {
    const containerExists = await this.checkContainerExists(databaseId, containerId);

    if (containerExists) {
      // const database = this.client.database(databaseId);
      // const container = database.container(containerId);

      const container: Container = this.client.database(databaseId).container(containerId);
      return container;
    }

    return undefined;
  }

  /**
   *
   * @param container
   *
   * 在此container中查找全部item
   */
  async getAllItems(container: Container): Promise<ItemDefinition[] | undefined> {
    const containerExists = await this.checkContainerExists(container.database.id, container.id);

    if (containerExists) {
      const { resources: existingItems } = await container.items.readAll().fetchAll();
      return existingItems;
    }

    return undefined;
  }

  /**
   *
   * @param container
   * @param itemId
   *
   * 在此container中以id查找item
   */
  async getItemById(container: Container, itemId: string): Promise<ItemDefinition[] | undefined> {
    const query = 'SELECT * FROM c WHERE c.id = @itemId';
    const sqlQuerySpec: SqlQuerySpec = {
      query,
      parameters: [{ name: '@itemId', value: itemId }],
    };
    const { resources } = await container.items.query(sqlQuerySpec).fetchAll();

    if (resources.length > 0) {
      return resources;
    }

    return undefined;
  }

  /**
   *
   * @param container
   * @param itemId
   *
   * 在此container中以id查找item
   */
  async getItemByReadId(container: Container, itemId: string): Promise<ItemDefinition | undefined> {
    const result = (await container.item(itemId).read()).resource;
    return result;
  }

  /**
   *
   * @param container
   * @param field 欄位
   * @param condition 條件 例：>、<、==、!=
   * @param value 欄位的值
   *
   * 在此container中以條件查找item
   */
  async getItemByCondition(
    container: Container,
    field: string,
    condition: string,
    value: any
  ): Promise<ItemDefinition[] | undefined> {
    const query = `SELECT * FROM c WHERE c.${field} ${condition} @value`;
    const sqlQuerySpec: SqlQuerySpec = {
      query,
      parameters: [{ name: '@value', value: value }],
    };

    const { resources } = await container.items.query(sqlQuerySpec).fetchAll();
    return resources || undefined;
  }

  /**
   *
   * @param container
   * @param itemId
   *
   * 確認此container中有無重複id的item
   */
  async checkDuplicateItem(container: Container, itemId: string): Promise<boolean> {
    const resource = await this.getAllItems(container);

    if (resource) {
      const isDuplicate = resource.some((item: any) => item.id === itemId);
      return isDuplicate;
    }

    return false;
  }

  /**
   *
   * @param container
   * @param item
   *
   * 在此container中新建item，若item無id欄位則會產生隨機亂數
   *
   * 範例：'id': '92fe5b6b-2135-449c-8e4c-d632b041dc45'
   */
  async createItem(container: Container, item: ItemDefinition): Promise<void> {
    if (item.id) {
      const result = await this.getItemById(container, item.id);
      if (result) {
        return alert('Item with the same ID already exists.');
      }
    }

    const { resource } = await container.items.create(item);

    if (resource) {
      console.log(`Created item: ${resource}`);
    }
  }

  /**
   *
   * @param container
   * @param item
   *
   * 在此container中以item的id為唯一辨識碼，已有資料：覆蓋item，無資料：新建item
   */
  async upsertItem(container: Container, item: ItemDefinition): Promise<void> {
    const { resource } = await container.items.upsert(item);
    console.log(`Upserted item: ${resource}`);
  }

  /**
   *
   * @param container
   * @param item
   *
   * 在此container中以item的id為唯一辨識碼，已有資料：更新item，無資料：新建item
   */
  async updateItem(container: Container, item: ItemDefinition): Promise<void> {
    if (item.id) {
      const result = await this.getItemById(container, item.id);

      if (result) {
        const updatedItem = { ...result[0], ...item };
        await container.item(item.id).replace(updatedItem);
        return;
      }
    }

    // 如果item沒有id欄位
    await this.createItem(container, item);
  }

  /**
   *
   * @param container
   * @param itemId
   *
   * 在此container中刪除單一item
   */
  async deleteItem(container: Container, itemId: string): Promise<void> {
    const item = await this.getItemById(container, itemId);

    if (item) {
      if (confirm('確定刪除？')) {
        await container.item(itemId).delete();
        return alert('Delete Item');
      }

      return;
    }

    alert(`Item dosen't exist`);
  }

  /**
   * 測試中
   */
  async subscribeToChanges(databaseId: string, containerId: string) {
    const partitionKey = '/itemId';
    const container = this.client.database(databaseId).container(containerId);
    const iterator = container.items.changeFeed(partitionKey);
    console.log('container', container);
    console.log('iterator', iterator);
  }
}
